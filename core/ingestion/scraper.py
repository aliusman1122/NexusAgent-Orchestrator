"""Enterprise-Grade Hybrid Web Extraction Engine for A7 Logics and external sources.

Supports dual-path intelligent content extraction:
- Path A: Card-Grid / Agency Landing Page Engine (preserves DOM hierarchy, cards, workflows,
  prevents sentence truncation, and fixes word glomming).
- Path B: Editorial / Article Engine (Trafilatura with structural heading validation).

Includes pre-sanitization entity & contact harvesting (emails, phones, physical addresses)
and executive metadata envelope formatting.
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import requests
import trafilatura
from bs4 import BeautifulSoup, Tag
from markdownify import markdownify as md
from langchain_core.documents import Document

from config.settings import settings

logger = logging.getLogger(__name__)


# Curated fallback knowledge extracted directly from https://a7logics.com/
FALLBACK_WEBSITE_KNOWLEDGE = [
    {
        "section": "Company Overview",
        "title": "A7 Logics - Digital Agency Overview",
        "content": (
            "A7 LOGICS is a premier digital agency specializing in custom web and mobile development. "
            "Our multidisciplinary team of specialists is a real force of proposal. "
            "We believe in creating new horizons for better revolution and future prospects. "
            "We work with the most innovative solutions on the market to help you get the best results, "
            "empowering your brand authority and modernizing your online identity."
        ),
    },
    {
        "section": "Services",
        "title": "Core Services Offered by A7 Logics",
        "content": (
            "A7 Logics offers the following core technology services:\n"
            "1. Web Application: We build applications for different purposes using technologies that allow maximum security and scalability.\n"
            "2. Mobile Apps: We build cutting-edge mobile apps for iOS and Android utilizing modern frameworks.\n"
            "3. Website Pro: We build professional responsive websites optimized for the most popular search engines (SEO).\n"
            "4. E-Commerce: High-converting online stores packed with feature-rich catalogs, shopping carts, and secure payment integrations.\n"
            "5. Frontend Development: Tailored user interfaces matched to client preferences to attract customers and boost brand sales.\n"
            "6. Logo & Branding: Identity creation focused on target audience engagement through proven graphic design techniques.\n"
            "7. Shared Hosting & Domains: Domain registration and high-performance hosting environments for clients."
        ),
    },
    {
        "section": "Development Process",
        "title": "A7 Logics 6-Step Development Process",
        "content": (
            "A7 Logics follows a mature 6-step website and application development process:\n"
            "1. Planning and Strategy: Structure thoughts, outline project requirements, graphically translate ideas, and formulate milestones.\n"
            "2. Research and Analysis: Meeting with clients to analyze end objectives and understand how digital products will drive business revenue.\n"
            "3. Content Creation: Detailed business proposals highlighting technical specifications, deliverables, cost quotes, and time commitments.\n"
            "4. Designing: UI/UX designers and analysts create custom design mockups tailored to client preferences.\n"
            "5. Testing and Quality Assurance: Comprehensive QA testing on staging servers with bug fixing based on client feedback.\n"
            "6. Deployment: Production deployment to client domain/hosting infrastructure, including ongoing support."
        ),
    },
    {
        "section": "Testimonials and Case Studies",
        "title": "Client Reviews & Testimonials",
        "content": (
            "Client Testimonials for A7 Logics:\n"
            "- Marsha Williams (5/5 Stars): 'A7Logics and I have worked together many times now and each time I become more impressed with our level of communication and his speed and accuracy in delivery.'\n"
            "- Moshe Cohen (5/5 Stars): 'Awesome Results by A7 Logics. This seller will bring life to your ideas! Exceptional Seller communication. Exclusive website. Fantastic.'\n"
            "- Deon Jenkins (5/5 Stars): 'I'm loving the partnership. The support deserves 5 stars. We will continue working with A7 Logics. We recommended this to other people that need their ColdFusion jobs done.'\n"
            "- David Steinbauer (5/5 Stars): 'I can highly recommend the A7 Logics team to everyone. My project was done on time and exactly according to the specifications. I will request more services soon.'\n"
            "- Hany Soliman (5/5 Stars): 'I highly recommend this seller for your projects. Delivers the work in short time providing high-quality designs.'\n"
            "- Vin Rick (5/5 Stars): 'I was a bit worried about sourcing work to overseas companies but I have been very pleased with how things went and am extremely happy with their work.'"
        ),
    },
    {
        "section": "Features & Value Proposition",
        "title": "Key Features of Working with A7 Logics",
        "content": (
            "Features and Strengths of A7 Logics:\n"
            "- Professional UX & UI: Rigorous user experience and user interface review for seamless digital journeys.\n"
            "- Unique Design: Standout bespoke designs that impress visitors and reinforce brand trust.\n"
            "- Plans and Pricing: Flexible monthly and project-based pricing structures for companies of all sizes.\n"
            "- Clean Coding: Highly organized, clean, and maintainable codebase engineered for speed and performance.\n"
            "- Team of Experts: Specialized engineers and designers capable of building complex enterprise systems.\n"
            "- Fast Support: Responsive team answering inquiries, comments, and support tickets typically within 24 hours."
        ),
    },
    {
        "section": "Technologies",
        "title": "Technologies and Stacks Used by A7 Logics",
        "content": (
            "Technologies used and supported by A7 Logics include: ColdFusion (CFM), Laravel, CodeIgniter, "
            "PHP, WordPress, Magento, Modern JavaScript Frameworks (React, Vue, Node.js), Python, and Java."
        ),
    },
    {
        "section": "Contact Information",
        "title": "A7 Logics Official Contact & Socials",
        "content": (
            "Official Contact Details:\n"
            "- Email: info@a7logics.com\n"
            "- LinkedIn: https://www.linkedin.com/in/a7-logics/\n"
            "- Facebook: https://www.facebook.com/a7logics\n"
            "- Official Website: https://a7logics.com/"
        ),
    },
]


class A7LogicsWebScraper:
    """Enterprise-Grade Hybrid Web Extraction Engine."""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.WEBSITE_URL).rstrip("/") + "/"
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36 A7LogicsChatbot/1.0"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

    def fetch_html(self, url: str) -> Optional[str]:
        """Fetch raw HTML content from the specified URL with robust multi-encoding support."""
        try:
            logger.info("Fetching website content from: %s", url)
            response = requests.get(url, headers=self.headers, timeout=15)
            response.raise_for_status()
            raw_bytes = response.content
            try:
                text = raw_bytes.decode("utf-8")
                if "\ufffd" in text:
                    text = raw_bytes.decode("cp1252", errors="replace")
            except UnicodeDecodeError:
                text = raw_bytes.decode("cp1252", errors="replace")
            return text
        except Exception as exc:
            logger.warning(
                "Failed to fetch live website (%s): %s. Will fallback to curated snapshot.",
                url,
                exc,
            )
            return None

    def clean_inline_text(self, element: Optional[Tag]) -> str:
        """Extract clean text preserving spacing between inline elements without word glomming."""
        if not element:
            return ""
        # Using separator=' ' prevents adjacent inline tags from concatenating without spacing
        text = element.get_text(separator=" ", strip=True)
        # Normalize typography
        text = text.replace("\u2018", "'").replace("\u2019", "'")
        text = text.replace("\u201c", '"').replace("\u201d", '"')
        text = text.replace("\u2013", "-").replace("\u2014", "--")
        text = text.replace(chr(65533), "'")
        text = re.sub(r"\s+", " ", text)
        # Fix spacing before punctuation caused by separator (e.g. "word ." -> "word.")
        text = re.sub(r"\s+([,.:;!?])", r"\1", text)
        return text.strip()

    def _clean_text(self, text: str) -> str:
        """Clean excessive whitespaces and convert quotes."""
        if not text:
            return ""
        text = text.replace("\u2018", "'").replace("\u2019", "'")
        text = text.replace("\u201c", '"').replace("\u201d", '"')
        text = text.replace("\u2013", "-").replace("\u2014", "--")
        text = text.replace(chr(65533), "'")
        text = re.sub(r"\bGET STARTED\b", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\n\s*\n+", "\n\n", text)
        text = re.sub(r"[ \t]+", " ", text)
        return text.strip()

    # STEP 1: ENTITY & CONTACT HARVESTING (BEFORE SANITIZATION)
    def harvest_entities_and_contacts(
        self, soup: BeautifulSoup, raw_html: str
    ) -> Dict[str, str]:
        """Harvest critical business identifiers (emails, phones, addresses) before DOM cleaning.

        Modern agency landing pages store critical business information in footers and contact
        sections that should never be lost to boilerplate sanitization.
        """
        emails: List[str] = []
        seen_emails = set()

        # 1. Company Emails from mailto: anchors
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.lower().startswith("mailto:"):
                clean_email = href.split(":", 1)[1].split("?")[0].strip().lower()
                if clean_email and clean_email not in seen_emails:
                    seen_emails.add(clean_email)
                    emails.append(clean_email)

        # Regex email harvesting across raw text and HTML
        email_regex = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}\b")
        for source in [soup.get_text(separator=" "), raw_html]:
            for match in email_regex.findall(source):
                m_lower = match.lower().strip()
                # Exclude image/asset false positives (e.g. logo@2x.png)
                if not re.search(r"\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf)$", m_lower):
                    if m_lower not in seen_emails:
                        seen_emails.add(m_lower)
                        emails.append(m_lower)

        # 2. Phone Numbers from tel: anchors and international/local regex
        phones: List[str] = []
        seen_phones = set()

        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.lower().startswith("tel:"):
                clean_tel = href.split(":", 1)[1].strip()
                if clean_tel and clean_tel not in seen_phones:
                    seen_phones.add(clean_tel)
                    phones.append(clean_tel)

        phone_regex = re.compile(
            r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}"
        )
        for match in phone_regex.findall(soup.get_text(separator=" ")):
            digits = re.sub(r"\D", "", match)
            # Valid international and local phones typically span 9 to 15 digits
            if 9 <= len(digits) <= 15:
                # Exclude year/date false positives (e.g. 2026-03-25)
                if not (len(digits) == 8 and match.startswith("20")):
                    clean_phone = re.sub(r"\s+", " ", match).strip()
                    if clean_phone not in seen_phones:
                        seen_phones.add(clean_phone)
                        phones.append(clean_phone)

        # 3. Physical Address & Headquarters
        address: Optional[str] = None

        # Check explicit <address> tags
        addr_elem = soup.find("address")
        if addr_elem and len(addr_elem.get_text(strip=True)) > 8:
            address = self.clean_inline_text(addr_elem)

        # Check schema.org microdata itemprop="address"
        if not address:
            itemprop_elem = soup.find(attrs={"itemprop": re.compile(r"address", re.I)})
            if itemprop_elem and len(itemprop_elem.get_text(strip=True)) > 8:
                address = self.clean_inline_text(itemprop_elem)

        # Check schema.org JSON-LD scripts
        if not address:
            for s in soup.find_all("script", type="application/ld+json"):
                try:
                    data = json.loads(s.get_text())
                    items = data if isinstance(data, list) else [data]
                    for item in items:
                        if isinstance(item, dict) and "address" in item:
                            addr_val = item["address"]
                            if isinstance(addr_val, dict):
                                parts = [
                                    addr_val.get("streetAddress"),
                                    addr_val.get("addressLocality"),
                                    addr_val.get("postalCode"),
                                    addr_val.get("addressCountry"),
                                ]
                                address = ", ".join(p for p in parts if p)
                            elif isinstance(addr_val, str):
                                address = addr_val.strip()
                            if address:
                                break
                    if address:
                        break
                except Exception:
                    pass

        # Check paragraphs or footer containers for address keywords
        if not address:
            addr_pattern = re.compile(
                r"\b(Campus|Sector\s+[A-Za-z0-9-]+|Street\s+\d+|Road|Avenue|Boulevard|Suite\s+\d+|P\.?O\.?\s*Box)\b.*?(?:Islamabad|Lahore|Karachi|New York|London|California|Paris|Berlin|Pakistan|USA|UK)",
                re.I | re.DOTALL,
            )
            for p in soup.find_all("p"):
                txt = self.clean_inline_text(p)
                if addr_pattern.search(txt):
                    address = txt
                    break

        return {
            "emails": ", ".join(emails) if emails else "None detected",
            "phones": ", ".join(phones) if phones else "None detected",
            "address": address or "None detected",
        }

    # STEP 2: DOM PRE-CLEANING (NON-DESTRUCTIVE)
    def pre_clean_dom(self, soup: BeautifulSoup) -> BeautifulSoup:
        """Safely remove ONLY guaranteed noise elements without destroying headers/footers.

        - Removes guaranteed noise tags (scripts, styles, dialogs, SVGs, forms, inputs).
        - Removes elements matching cookie banners, analytics, and modals.
        - Decomposes navigation link-lists (> 70% link text ratio) while keeping headers/footers.
        """
        # 1. Guaranteed noise tags
        noise_tags = [
            "script",
            "style",
            "noscript",
            "svg",
            "canvas",
            "iframe",
            "form",
            "input",
            "select",
            "button",
            "dialog",
        ]
        for tag in noise_tags:
            for el in soup.find_all(tag):
                el.decompose()

        # 2. Elements with classes/ids matching cookie banners, analytics, and modals
        noise_pattern = re.compile(
            r"(cookie|consent|modal-backdrop|popup|ad-container|advertisement|newsletter-signup)",
            re.IGNORECASE,
        )
        for el in list(soup.find_all(True)):
            if getattr(el, "attrs", None) is None:
                continue
            if el.name in ["html", "body", "main", "article"]:
                continue
            classes = (
                " ".join(el.get("class", []))
                if isinstance(el.get("class"), list)
                else str(el.get("class", ""))
            )
            el_id = str(el.get("id", ""))
            if noise_pattern.search(classes) or noise_pattern.search(el_id):
                el.decompose()

        # 3. Strip ONLY navigation link-lists (where anchor tags exceed 70% of total text length)
        for el in list(soup.find_all(["ul", "ol", "nav"])):
            if getattr(el, "attrs", None) is None:
                continue
            if el.name in ["html", "body", "main", "article"]:
                continue
            text = el.get_text(separator=" ", strip=True)
            if not text:
                continue
            links = el.find_all("a")
            if len(links) >= 2:
                link_text = "".join(a.get_text(strip=True) for a in links)
                ratio = len(link_text) / max(len(text), 1)
                if ratio > 0.70:
                    el.decompose()

        # Check navigation sub-menus inside headers/footers/divs
        nav_menu_pattern = re.compile(
            r"\b(menu|navbar|nav-links|quick-links|important-links|top-bar)\b",
            re.IGNORECASE,
        )
        for el in list(soup.find_all("div")):
            if getattr(el, "attrs", None) is None:
                continue
            classes = (
                " ".join(el.get("class", []))
                if isinstance(el.get("class"), list)
                else str(el.get("class", ""))
            )
            el_id = str(el.get("id", ""))
            if nav_menu_pattern.search(classes) or nav_menu_pattern.search(el_id):
                text = el.get_text(separator=" ", strip=True)
                links = el.find_all("a")
                if len(links) >= 2:
                    link_text = "".join(a.get_text(strip=True) for a in links)
                    ratio = len(link_text) / max(len(text), 1) if text else 1.0
                    if ratio > 0.70:
                        el.decompose()

        return soup

    def clean_soup(self, soup: BeautifulSoup) -> BeautifulSoup:
        """Backward compatibility alias for pre_clean_dom."""
        return self.pre_clean_dom(soup)

    # STEP 3 - PATH A: CARD-GRID / AGENCY LANDING PAGE ENGINE
    def extract_path_a_card_grid(self, soup: BeautifulSoup) -> str:
        """Path A: Card-Grid / Agency Landing Page Engine (DOM Hierarchy Preservation).

        1. Preserves exact header ranks:
           - <h1> -> #
           - <h2> -> ##
           - <h3>, card headers, bold titles -> ###
           - <h4>, <h5> -> ####
        2. Preserves lists & sequential workflow steps (rendered as numbered lists or bullets).
        3. Prevents sentence truncation and word glomming across nested tags.
        """
        sections = soup.find_all("section")
        if not sections:
            main_elem = (
                soup.find("main")
                or soup.find("article")
                or soup.find(id=re.compile(r"content", re.I))
                or soup.find("body")
                or soup
            )
            sections = main_elem.find_all(["section", "div"], recursive=False) or [main_elem]

        lines: List[str] = []
        seen_items = set()

        for sec in sections:
            sec_id = str(sec.get("id", "")).lower()
            sec_lines: List[str] = []

            # 1. Section Header Detection
            h1 = sec.find("h1") if not lines else None
            h2 = sec.find("h2")
            if h1:
                h1_text = self.clean_inline_text(h1)
                if h1_text and h1_text.lower() not in seen_items:
                    seen_items.add(h1_text.lower())
                    sec_lines.append(f"# {h1_text}")

            if h2:
                h2_text = self.clean_inline_text(h2)
                if h2_text and h2_text.lower() not in seen_items:
                    seen_items.add(h2_text.lower())
                    sec_lines.append(f"\n## {h2_text}\n")

            # 2. Check for sequential cards / grid items / workflow steps
            card_selectors = (
                ".card, .item, [class*='card-'], [class*='service-'], "
                "[class*='feature-'], [class*='step-'], [class*='process-']"
            )
            raw_cards = sec.select(card_selectors)
            content_cards = []
            for c in raw_cards:
                title_elem = c.find(["h3", "h4", "h5", "h6", "strong", "b"])
                if title_elem:
                    content_cards.append((c, title_elem))

            is_process = (
                "process" in sec_id
                or "about-2" in sec_id
                or any("step" in str(c.get("class", [])) for c, _ in content_cards)
            )

            if content_cards and len(content_cards) >= 2:
                step_num = 1
                for card, title_elem in content_cards:
                    title = self.clean_inline_text(title_elem)
                    desc_elem = card.find("p")
                    desc = self.clean_inline_text(desc_elem) if desc_elem else ""

                    # Fix known live site sentence truncations (e.g. A7 Logics "Team of Experts")
                    if "Team of Experts" in title and (desc.endswith("be") or len(desc) < 40):
                        desc = (
                            "Specialized engineers and designers capable of building complex enterprise "
                            "systems and tailoring features to client specifications."
                        )
                    if "within 24 hour" in desc.lower():
                        desc = re.sub(r"within 24 hour\b", "within 24 hours", desc, flags=re.I)

                    if desc and not desc.endswith((".", "!", "?", ":", '"')):
                        desc += "."

                    item_key = f"{title.lower()}||{desc[:40].lower()}"
                    if item_key in seen_items:
                        continue
                    seen_items.add(item_key)

                    if is_process:
                        clean_title = re.sub(r"^\d+[\.\-\s]+", "", title).strip()
                        sec_lines.append(f"{step_num}. **{clean_title}**: {desc}")
                        step_num += 1
                    else:
                        if title:
                            sec_lines.append(f"### {title}")
                        if desc:
                            sec_lines.append(f"{desc}\n")
            else:
                # General section paragraphs
                for p in sec.find_all("p", recursive=True):
                    txt = self.clean_inline_text(p)
                    if txt and len(txt) > 20:
                        if not txt.endswith((".", "!", "?", '"')):
                            txt += "."
                        if txt.lower() not in seen_items:
                            seen_items.add(txt.lower())
                            sec_lines.append(f"{txt}\n")

                # General section lists
                for ul in sec.find_all(["ul", "ol"], recursive=True):
                    is_ol = ul.name == "ol"
                    for idx, li in enumerate(ul.find_all("li", recursive=False), start=1):
                        txt = self.clean_inline_text(li)
                        if txt and txt.lower() not in seen_items:
                            seen_items.add(txt.lower())
                            prefix = f"{idx}. " if is_ol else "* "
                            sec_lines.append(f"{prefix}{txt}")

            if sec_lines:
                lines.append("\n".join(sec_lines))

        raw_md = "\n\n".join(lines)
        raw_md = re.sub(r"\n{3,}", "\n\n", raw_md).strip()
        return raw_md

    # STEP 4: DOCUMENT NORMALIZATION & METADATA ENVELOPE
    def extract_clean_markdown(
        self, url: Optional[str] = None, html: Optional[str] = None
    ) -> Tuple[str, str]:
        """Extract clean, structured Markdown using the Hybrid Extraction Engine.

        Step 1: Entity & Contact Harvesting (emails, phones, addresses) before sanitization.
        Step 2: Non-Destructive DOM Pre-Cleaning.
        Step 3: Hybrid Extraction (Path A Card-Grid Engine vs Path B Editorial Trafilatura).
        Step 4: Executive Metadata Envelope Normalization.

        Returns:
            Tuple[str, str]: (page_title, structured_markdown_content)
        """
        target_url = (url or self.base_url).strip()
        current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        downloaded_html = html
        if not downloaded_html:
            downloaded_html = self.fetch_html(target_url)

        if not downloaded_html:
            # If targeting A7 Logics domain and live site is unreachable, use snapshot
            if "a7logics" in target_url.lower():
                logger.info("Using curated fallback snapshot for %s", target_url)
                page_title = "A7 Logics - Digital Agency Overview"
                snapshot_body = "\n\n".join(
                    f"## {item['title']}\n{item['content']}"
                    for item in FALLBACK_WEBSITE_KNOWLEDGE
                )
                structured = (
                    f"# {page_title}\n"
                    f"- **Source URL:** {target_url}\n"
                    f"- **Scraped Date:** {current_date}\n"
                    f"- **Document Structure:** Agency Landing Page\n\n"
                    f"---\n\n"
                    f"{snapshot_body}\n\n"
                    f"---\n\n"
                    f"## Contact & Business Identifiers\n"
                    f"- **Email(s):** info@a7logics.com\n"
                    f"- **Phone(s):** None detected\n"
                    f"- **Physical Address / Headquarters:** None detected\n"
                )
                return page_title, structured

            page_title = "Web Knowledge Source"
            empty_structured = (
                f"# {page_title}\n"
                f"- **Source URL:** {target_url}\n"
                f"- **Scraped Date:** {current_date}\n"
                f"- **Document Structure:** Unreachable\n\n"
                f"---\n\n"
                f"Could not retrieve live HTML content from {target_url}."
            )
            return page_title, empty_structured

        raw_soup = BeautifulSoup(downloaded_html, "html.parser")

        # 1. Page Title Extraction
        page_title = ""
        title_tag = raw_soup.find("title")
        if title_tag and title_tag.get_text(strip=True):
            page_title = self.clean_inline_text(title_tag)
        elif raw_soup.find("h1"):
            page_title = self.clean_inline_text(raw_soup.find("h1"))

        if not page_title:
            try:
                meta = trafilatura.extract_metadata(downloaded_html)
                if meta and meta.title:
                    page_title = self._clean_text(meta.title)
            except Exception:
                pass

        if not page_title:
            try:
                parsed = urlparse(target_url)
                page_title = parsed.netloc or "Web Knowledge Source"
            except Exception:
                page_title = "Web Knowledge Source"

        # Step 1: Harvest Entities & Contacts BEFORE sanitization
        entities = self.harvest_entities_and_contacts(raw_soup, downloaded_html)

        # Step 2: Non-destructive DOM pre-cleaning
        cleaned_soup = self.pre_clean_dom(BeautifulSoup(downloaded_html, "html.parser"))

        # Step 3: Hybrid Parsing & Content-Type Detection
        p_tags = cleaned_soup.find_all("p")
        long_paragraphs = [p for p in p_tags if len(p.get_text(strip=True)) > 150]
        card_elements = cleaned_soup.select(
            ".card, .item, [class*='card-'], [class*='service-'], [class*='feature-'], [class*='step-']"
        )

        is_candidate_article = (
            len(long_paragraphs) >= 3 or bool(cleaned_soup.find("article"))
        ) and len(card_elements) < 15

        layout_name = "Agency Landing Page"
        content_markdown = ""

        # Path B: Editorial / Article Engine (Trafilatura)
        if is_candidate_article:
            try:
                traf_md = trafilatura.extract(
                    str(cleaned_soup),
                    output_format="markdown",
                    favor_precision=True,
                )
                has_headings = bool(
                    traf_md and re.search(r"^#{1,4}\s+\S+", traf_md, re.MULTILINE)
                )
                # Fall back to Path A if Trafilatura strips headings or extracts < 200 chars
                if traf_md and len(traf_md.strip()) >= 200 and has_headings:
                    content_markdown = self._clean_text(traf_md)
                    layout_name = "Article"
            except Exception as exc:
                logger.warning(
                    "Trafilatura extraction failed for %s: %s; falling back to Path A",
                    target_url,
                    exc,
                )

        # Path A: Card-Grid / Agency Landing Page Engine (DOM Hierarchy Preservation)
        if not content_markdown:
            content_markdown = self.extract_path_a_card_grid(cleaned_soup)
            layout_name = "Agency Landing Page"

        # Markdownify fallback if still insufficient
        if not content_markdown or len(content_markdown) < 50:
            logger.info("Applying markdownify fallback for %s", target_url)
            body_elem = cleaned_soup.find("body") or cleaned_soup
            try:
                content_markdown = self._clean_text(
                    md(str(body_elem), heading_style="ATX", strip=["a", "img", "button"])
                )
            except Exception:
                content_markdown = self._clean_text(body_elem.get_text(separator="\n"))

        # Step 4: Executive Metadata Envelope Normalization
        structured_markdown = (
            f"# {page_title}\n"
            f"- **Source URL:** {target_url}\n"
            f"- **Scraped Date:** {current_date}\n"
            f"- **Document Structure:** {layout_name}\n\n"
            f"---\n\n"
            f"{content_markdown}\n\n"
            f"---\n\n"
            f"## Contact & Business Identifiers\n"
            f"- **Email(s):** {entities['emails']}\n"
            f"- **Phone(s):** {entities['phones']}\n"
            f"- **Physical Address / Headquarters:** {entities['address']}\n"
        )

        return page_title, structured_markdown

    def extract_sections(self, soup: BeautifulSoup) -> List[Document]:
        """Parse structured sections into LangChain Document objects with complete sentences."""
        documents: List[Document] = []

        # 1. Hero / Intro Slider
        hero_section = soup.select_one("section#slider-1")
        if hero_section:
            for b in hero_section.select("a, button, .btn"):
                b.decompose()
            hero_raw = self.clean_inline_text(hero_section)
            if "Escape the fad" in hero_raw or "Custom Application" in hero_raw:
                hero_clean = (
                    "A7 Logics is a premier digital agency specializing in custom web and mobile development. "
                    "We work with the most innovative solutions on the market to help you get the best results, "
                    "giving authority to your brand and modernizing your online identity."
                )
            else:
                hero_clean = hero_raw
            documents.append(
                Document(
                    page_content=f"Company Introduction & Mission:\n{hero_clean}",
                    metadata={
                        "source": "website",
                        "url": self.base_url,
                        "section": "Hero Overview",
                    },
                )
            )

        # 2. Services Section (#services-1)
        services_section = soup.select_one("section#services-1")
        if services_section:
            service_cards = services_section.select(".item .card")
            services_lines = ["A7 Logics Core Services:"]
            for card in service_cards:
                h4 = card.find("h4")
                p = card.find("p")
                title = self.clean_inline_text(h4) if h4 else ""
                desc = self.clean_inline_text(p) if p else ""
                if desc and not desc.endswith((".", "!", "?")):
                    desc += "."
                if title:
                    services_lines.append(f"- {title}: {desc}")
            if len(services_lines) > 1:
                documents.append(
                    Document(
                        page_content="\n".join(services_lines),
                        metadata={
                            "source": "website",
                            "url": self.base_url,
                            "section": "Services",
                        },
                    )
                )

        # 3. About Us Section (#about-1)
        about_section = soup.select_one("section#about-1")
        if about_section:
            about_text = self.clean_inline_text(about_section)
            if about_text:
                about_text = re.sub(r"\bAbout Us\b\s*", "", about_text, flags=re.IGNORECASE).strip()
                documents.append(
                    Document(
                        page_content=f"About A7 Logics & Values:\n{about_text}",
                        metadata={
                            "source": "website",
                            "url": self.base_url,
                            "section": "About Us",
                        },
                    )
                )

        # 4. Development Process (#about-2)
        dev_section = soup.select_one("section#about-2")
        if dev_section:
            process_items = dev_section.select(".row.item")
            process_lines = ["A7 Logics Development Process:"]
            for item in process_items:
                h4 = item.find("h4")
                p = item.find("p")
                step_title = self.clean_inline_text(h4) if h4 else ""
                step_desc = self.clean_inline_text(p) if p else ""
                if step_desc and not step_desc.endswith((".", "!", "?")):
                    step_desc += "."
                if step_title:
                    process_lines.append(f"Step: {step_title} - {step_desc}")
            if len(process_lines) > 1:
                documents.append(
                    Document(
                        page_content="\n".join(process_lines),
                        metadata={
                            "source": "website",
                            "url": self.base_url,
                            "section": "Development Process",
                        },
                    )
                )

        # 5. Testimonials (#testimonials-1)
        test_section = soup.select_one("section#testimonials-1")
        if test_section:
            test_items = test_section.select(".slider-item .card")
            test_lines = ["Client Testimonials & Case Reviews:"]
            for item in test_items:
                h4 = item.find("h4")
                p = item.find("p")
                author = self.clean_inline_text(h4) if h4 else "Anonymous"
                quote = self.clean_inline_text(p) if p else ""
                if quote and not quote.endswith((".", "!", "?", '"')):
                    quote += "."
                if quote:
                    test_lines.append(f"Review by {author}: \"{quote}\"")
            if len(test_lines) > 1:
                documents.append(
                    Document(
                        page_content="\n".join(test_lines),
                        metadata={
                            "source": "website",
                            "url": self.base_url,
                            "section": "Testimonials",
                        },
                    )
                )

        # 6. Features (#features-1)
        features_section = soup.select_one("section#features-1")
        if features_section:
            feat_items = features_section.select(".item .card")
            feat_lines = ["A7 Logics Key Features & Capabilities:"]
            for item in feat_items:
                h4 = item.find("h4")
                p = item.find("p")
                title = self.clean_inline_text(h4) if h4 else ""
                desc = self.clean_inline_text(p) if p else ""
                if "Team of Experts" in title and (desc.endswith("be") or len(desc) < 50):
                    desc = (
                        "Specialized engineers and designers capable of building complex enterprise systems "
                        "and tailoring features to client specifications."
                    )
                if "within 24 hour" in desc.lower():
                    desc = re.sub(r"within 24 hour\b", "within 24 hours", desc, flags=re.IGNORECASE)
                if desc and not desc.endswith((".", "!", "?")):
                    desc += "."
                if title:
                    feat_lines.append(f"- {title}: {desc}")
            if len(feat_lines) > 1:
                documents.append(
                    Document(
                        page_content="\n".join(feat_lines),
                        metadata={
                            "source": "website",
                            "url": self.base_url,
                            "section": "Features",
                        },
                    )
                )

        # 7. Technologies & Contact Info
        tech_lines = [
            "Technologies & Stacks:",
            "A7 Logics utilizes ColdFusion, Laravel, CodeIgniter, PHP, WordPress, Magento, JavaScript frameworks, Python, and Java.",
            "Contact: info@a7logics.com | LinkedIn: https://www.linkedin.com/in/a7-logics/ | Facebook: https://www.facebook.com/a7logics",
        ]
        documents.append(
            Document(
                page_content="\n".join(tech_lines),
                metadata={
                    "source": "website",
                    "url": self.base_url,
                    "section": "Technologies & Contact",
                },
            )
        )

        return documents

    def scrape(self) -> List[Document]:
        """Scrape target website and return parsed Document objects.

        If targeting A7 Logics, uses specialized section extraction and snapshot fallback.
        For any other company or generic website URL, dynamically uses extract_clean_markdown.
        """
        # 1. Specialized A7 Logics extraction if targeting A7 Logics domain
        if "a7logics" in self.base_url.lower():
            html = self.fetch_html(self.base_url)
            if not html:
                logger.info("Using verified fallback snapshot for %s", self.base_url)
                return [
                    Document(
                        page_content=item["content"],
                        metadata={
                            "source": "website",
                            "url": self.base_url,
                            "section": item["section"],
                        },
                    )
                    for item in FALLBACK_WEBSITE_KNOWLEDGE
                ]

            soup = BeautifulSoup(html, "html.parser")
            self.clean_soup(soup)
            docs = self.extract_sections(soup)
            if docs:
                logger.info(
                    "Extracted %d structured documents from %s", len(docs), self.base_url
                )
                return docs

        # 2. Generic website target: Intelligent Boilerplate Stripping & Clean Markdown
        try:
            logger.info("Extracting clean structured markdown from: %s", self.base_url)
            page_title, structured_md = self.extract_clean_markdown(self.base_url)
            if structured_md:
                return [
                    Document(
                        page_content=structured_md,
                        metadata={
                            "source": "website",
                            "url": self.base_url,
                            "section": page_title,
                            "title": page_title,
                            "source_type": "web_text",
                        },
                    )
                ]
        except Exception as exc:
            logger.warning("Clean markdown extraction failed for %s: %s", self.base_url, exc)

        return [
            Document(
                page_content=item["content"],
                metadata={
                    "source": "website",
                    "url": self.base_url,
                    "section": item["section"],
                },
            )
            for item in FALLBACK_WEBSITE_KNOWLEDGE
        ]

    def scrape_as_markdown(self, url: Optional[str] = None) -> Tuple[str, str, Document]:
        """Convenience method returning (title, markdown_content, Document)."""
        target = url or self.base_url
        title, md_content = self.extract_clean_markdown(target)
        doc = Document(
            page_content=md_content,
            metadata={
                "source": target,
                "source_name": target,
                "url": target,
                "title": title,
                "section": title,
                "source_type": "web_text",
            },
        )
        return title, md_content, doc


def scrape_a7logics_website(url: Optional[str] = None) -> List[Document]:
    """Convenience helper to scrape website content."""
    scraper = A7LogicsWebScraper(base_url=url)
    return scraper.scrape()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    scraped_docs = scrape_a7logics_website()
    print(f"Total documents extracted: {len(scraped_docs)}")
    for i, doc in enumerate(scraped_docs, start=1):
        print(f"\n--- Doc {i} [{doc.metadata.get('section', 'General')}] ---")
        print(doc.page_content[:200] + "...")
