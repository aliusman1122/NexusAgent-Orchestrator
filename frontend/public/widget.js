/**
 * NexusAgent Multi-Tenant Embeddable Chat Widget Loader
 * Lightweight vanilla JavaScript loader (< 5 KB, zero dependencies)
 */
(function () {
  "use strict";

  // Prevent multiple initializations on the same host page
  if (window.__NEXUS_WIDGET_LOADED__) return;
  window.__NEXUS_WIDGET_LOADED__ = true;

  function initWidget() {
    // 1. Locate the loader script tag
    var currentScript =
      document.currentScript ||
      (function () {
        var scripts = document.getElementsByTagName("script");
        for (var i = scripts.length - 1; i >= 0; i--) {
          var src = scripts[i].src || "";
          if (src.indexOf("widget.js") !== -1) {
            return scripts[i];
          }
        }
        return null;
      })();

    if (!currentScript) {
      console.warn("[NexusWidget] Loader script tag not found.");
      return;
    }

    // 2. Read attributes from script tag
    var tenantId =
      currentScript.getAttribute("data-tenant-id") ||
      currentScript.getAttribute("data-clinic-id") ||
      currentScript.getAttribute("data-agent-id") ||
      "a7_logics";

    var profileId = currentScript.getAttribute("data-profile-id") || "";
    var position = (currentScript.getAttribute("data-position") || "bottom-right").toLowerCase();

    var appUrl = currentScript.getAttribute("data-app-url");
    if (!appUrl) {
      try {
        var parsedUrl = new URL(currentScript.src);
        appUrl = parsedUrl.origin;
      } catch (_e) {
        appUrl = "http://localhost:3000";
      }
    }
    appUrl = appUrl.replace(/\/+$/, "");

    // 3. Create host container element
    var container = document.createElement("div");
    container.id = "nexus-agent-widget-container";
    container.setAttribute("data-nexus-tenant", tenantId);

    // Apply baseline corner positioning
    var isRight = position.indexOf("right") !== -1;
    var isTop = position.indexOf("top") !== -1;

    var containerStyles = {
      position: "fixed",
      zIndex: "2147483647",
      border: "none",
      background: "transparent",
      overflow: "visible",
      transition: "width 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s ease",
      pointerEvents: "auto",
    };

    if (isTop) {
      containerStyles.top = "20px";
      containerStyles.bottom = "auto";
    } else {
      containerStyles.bottom = "20px";
      containerStyles.top = "auto";
    }

    if (isRight) {
      containerStyles.right = "20px";
      containerStyles.left = "auto";
    } else {
      containerStyles.left = "20px";
      containerStyles.right = "auto";
    }

    // Default collapsed sizing (FAB only - never blocks host clicks)
    containerStyles.width = "80px";
    containerStyles.height = "80px";

    for (var key in containerStyles) {
      container.style[key] = containerStyles[key];
    }

    // 4. Create iframe
    var iframe = document.createElement("iframe");
    iframe.id = "nexus-agent-widget-iframe";
    iframe.title = "AI Chat Assistant";

    var iframeParams = [
      "tenant=" + encodeURIComponent(tenantId),
      "pos=" + encodeURIComponent(position),
    ];
    if (profileId) {
      iframeParams.push("profile=" + encodeURIComponent(profileId));
    }

    var iframeSrc = appUrl + "/embed/widget?" + iframeParams.join("&");
    iframe.src = iframeSrc;

    var iframeStyles = {
      width: "100%",
      height: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      overflow: "hidden",
      display: "block",
      colorScheme: "normal",
    };

    for (var iKey in iframeStyles) {
      iframe.style[iKey] = iframeStyles[iKey];
    }

    iframe.setAttribute("allow", "clipboard-write");
    container.appendChild(iframe);

    // 5. Safely append to document
    function mount() {
      if (!document.body) {
        window.addEventListener("DOMContentLoaded", mount);
        return;
      }
      document.body.appendChild(container);
    }
    mount();

    // 6. Bi-directional PostMessage event listener
    window.addEventListener("message", function (event) {
      // Validate origin if possible
      if (event.origin && event.origin !== "null" && appUrl.indexOf(event.origin) === -1) {
        // Message is from another origin, ignore safely
        return;
      }

      var data = event.data;
      if (!data || typeof data !== "object") return;

      // Handle Dynamic Resizing
      if (data.type === "nexus_widget_resize") {
        if (data.state === "expanded") {
          // Expanded chat panel
          container.style.width = "420px";
          container.style.height = "660px";
          container.style.maxWidth = "calc(100vw - 32px)";
          container.style.maxHeight = "calc(100vh - 32px)";
        } else {
          // Collapsed floating button
          container.style.width = "80px";
          container.style.height = "80px";
          container.style.maxWidth = "80px";
          container.style.maxHeight = "80px";
        }
      }

      // Handle clean Hide / Unmount
      if (data.type === "nexus_widget_hide") {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWidget);
  } else {
    initWidget();
  }
})();
