(function () {
  "use strict";

  const FORM_ENDPOINT = "https://zhnbwyjuyjonexqbauuz.supabase.co/functions/v1/submit-website-enquiry";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_s-OqrQBYGxHvbRhgkG3hSw_6wJk9eyO";

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const phoneCharacters = /^[0-9()\s+.-]+$/;
  const countryCodePattern = /^\+[1-9]\d{0,3}$/;
  const integerPattern = /^\d+$/;
  const ignoredNames = new Set(["website_company"]);

  function getWrap(field) {
    return field.closest(".webform-field");
  }

  function setError(field, message) {
    const wrap = getWrap(field);
    if (!wrap) return;
    wrap.classList.toggle("is-invalid", Boolean(message));
    field.setAttribute("aria-invalid", message ? "true" : "false");

    const error = wrap.querySelector(".webform-error");
    if (error) error.textContent = message || "";
  }

  function validateField(field) {
    if (!field || field.disabled || field.type === "hidden" || ignoredNames.has(field.name)) return true;

    const value = typeof field.value === "string" ? field.value.trim() : "";
    let message = "";

    if (field.type === "checkbox") {
      if (field.required && !field.checked) message = "Please agree to the privacy notice before submitting.";
      setError(field, message);
      return !message;
    }

    if (field.required && !value) {
      if (field.tagName === "SELECT") message = "Please select an option.";
      else if (field.type === "email") message = "Please enter your email address.";
      else if (field.name === "phone") message = "Please enter your phone number.";
      else message = field.dataset.errorRequired || "This field is required.";
    } else if (value && field.type === "email" && !emailPattern.test(value)) {
      message = "Please enter a valid email address.";
    } else if (value && field.name === "phone") {
      const digitCount = value.replace(/\D/g, "").length;
      if (!phoneCharacters.test(value) || digitCount < 7 || digitCount > 15) {
        message = "Enter a valid phone number with 7–15 digits.";
      }
    } else if (value && field.name === "country_code" && !countryCodePattern.test(value)) {
      message = "Please select a valid phone country code.";
    } else if (value && field.type === "url") {
      try {
        const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : "https://" + value;
        const url = new URL(candidate);
        if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".") ||
            /\s/.test(value) || !/^[a-z0-9.-]+$/i.test(url.hostname) ||
            url.hostname.startsWith(".") || url.hostname.endsWith(".") ||
            url.hostname.includes("..")) {
          message = "Enter a valid domain or website URL, for example sample.com.";
        }
      } catch (_) {
        message = "Enter a valid domain or website URL, for example sample.com.";
      }
    } else if (value && ["employee_count", "outlet_count"].includes(field.name)) {
      const max = field.name === "employee_count" ? 100000000 : 1000000;
      if (!integerPattern.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > max) {
        message = "Enter a whole number greater than 0.";
      }
    } else if (field.required && field.tagName === "SELECT" && !value) {
      message = "Please select an option.";
    } else if (value && field.maxLength > 0 && value.length > field.maxLength) {
      message = "Please shorten this text.";
    }

    setError(field, message);
    return !message;
  }

  function showStatus(status, message, kind) {
    if (!status) return;
    status.className = "webform-status is-visible" + (kind ? " is-" + kind : "");
    status.textContent = message;
  }

  document.querySelectorAll("[data-webform]").forEach((form) => {
    const status = form.querySelector("[data-form-status]");
    const submit = form.querySelector('[type="submit"]');
    const fields = Array.from(form.querySelectorAll("input, select, textarea"))
      .filter((field) => field.type !== "hidden" && !ignoredNames.has(field.name));

    fields.forEach((field) => {
      field.addEventListener("blur", () => validateField(field));
      field.addEventListener("change", () => validateField(field));
      field.addEventListener("input", () => {
        if (field.getAttribute("aria-invalid") === "true") validateField(field);
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.dataset.submitting === "true") return;

      const invalidFields = fields.filter((field) => !validateField(field));
      if (invalidFields.length) {
        showStatus(status, "Please correct the highlighted fields before submitting.", "error");
        invalidFields[0].focus();
        invalidFields[0].scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      data.form_type = form.dataset.formType;
      data.privacy_consent = form.querySelector('[name="privacy_consent"]')?.checked === true;
      data.source_page = window.location.href;
      // Accept a bare domain (sample.com) and normalize it for storage and server validation.
      if (typeof data.website_url === "string" && data.website_url.trim()) {
        const enteredUrl = data.website_url.trim();
        data.website_url = /^[a-z][a-z0-9+.-]*:\/\//i.test(enteredUrl)
          ? enteredUrl
          : "https://" + enteredUrl;
      }

      form.dataset.submitting = "true";
      if (submit) {
        submit.disabled = true;
        submit.dataset.originalText = submit.innerHTML;
        submit.textContent = "Submitting…";
      }
      showStatus(status, "Submitting your enquiry securely…", "");

      try {
        const response = await fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_PUBLISHABLE_KEY
          },
          body: JSON.stringify(data)
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
          if (result.field) {
            const field = form.querySelector('[name="' + CSS.escape(result.field) + '"]');
            if (field) {
              setError(field, result.message || "Please check this field.");
              field.focus();
              field.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
          throw new Error(result.message || "We could not submit your enquiry. Please try again.");
        }

        // Keep the public confirmation short and neutral. Internal email configuration and
        // reference details belong in server logs/database, not in the customer-facing message.
        showStatus(status, "Successfully submitted.", "success");
        form.reset();
        fields.forEach((field) => setError(field, ""));
        if (status) {
          status.setAttribute("role", "status");
          status.setAttribute("aria-live", "polite");
          status.setAttribute("tabindex", "-1");
          status.focus();
          status.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } catch (error) {
        showStatus(status, error instanceof Error ? error.message : "Something went wrong. Please try again.", "error");
      } finally {
        form.dataset.submitting = "false";
        if (submit) {
          submit.disabled = false;
          submit.innerHTML = submit.dataset.originalText || "Submit Enquiry →";
        }
      }
    });
  });
})();
