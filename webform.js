(function () {
  "use strict";
  const FORM_ENDPOINT = "https://zcqncbdfurhlnspzziyd.supabase.co/functions/v1/submit-website-enquiry";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ymLV5njVvbll5eL9J_HP8g_7AfElGhz";

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const phonePattern = /^[0-9()\s+.-]{7,24}$/;
  const digitsOnly = /^\d+$/;

  function setError(field, message) {
    const wrap = field.closest(".webform-field");
    if (!wrap) return;
    wrap.classList.toggle("is-invalid", Boolean(message));
    field.setAttribute("aria-invalid", message ? "true" : "false");
    const error = wrap.querySelector(".webform-error");
    if (error) error.textContent = message || "";
  }

  function validateField(field) {
    if (field.type === "hidden" || field.name === "website_company") return true;
    if (field.type === "checkbox") {
      const valid = !field.required || field.checked;
      const wrap = field.closest(".webform-field");
      if (wrap) {
        wrap.classList.toggle("is-invalid", !valid);
        const error = wrap.querySelector(".webform-error");
        if (error) error.textContent = valid ? "" : "Please agree before submitting.";
      }
      field.setAttribute("aria-invalid", valid ? "false" : "true");
      return valid;
    }
    const value = field.value.trim();
    let message = "";
    if (field.required && !value) message = field.dataset.errorRequired || "This field is required.";
    else if (value && field.type === "email" && !emailPattern.test(value)) message = "Please enter a valid email address.";
    else if (value && field.name === "phone" && !phonePattern.test(value)) message = "Please enter a valid phone number.";
    else if (value && ["employee_count", "outlet_count"].includes(field.name) && (!digitsOnly.test(value) || Number(value) < 1)) message = "Please enter a valid number.";
    else if (field.tagName === "SELECT" && field.required && !value) message = "Please select an option.";
    setError(field, message);
    return !message;
  }

  document.querySelectorAll("[data-webform]").forEach((form) => {
    const status = form.querySelector("[data-form-status]");
    const submit = form.querySelector('[type="submit"]');
    const fields = Array.from(form.querySelectorAll("input, select, textarea"));
    fields.forEach((field) => {
      field.addEventListener("blur", () => validateField(field));
      field.addEventListener("change", () => validateField(field));
      if (field.tagName === "INPUT" || field.tagName === "TEXTAREA") field.addEventListener("input", () => {
        if (field.getAttribute("aria-invalid") === "true") validateField(field);
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.dataset.submitting === "true") return;
      const invalid = fields.filter((field) => !validateField(field));
      if (invalid.length) {
        invalid[0].focus();
        if (status) {
          status.className = "webform-status is-visible is-error";
          status.textContent = "Please check the highlighted fields and try again.";
        }
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      data.form_type = form.dataset.formType;
      data.privacy_consent = form.querySelector('[name="privacy_consent"]')?.checked === true;
      data.source_page = window.location.href;
      if (status) {
        status.className = "webform-status is-visible";
        status.textContent = "Submitting your enquiry securely…";
      }
      form.dataset.submitting = "true";
      if (submit) {
        submit.disabled = true;
        submit.dataset.originalText = submit.textContent;
        submit.textContent = "Submitting…";
      }
      try {
        const response = await fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify(data)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          if (result.field) {
            const field = form.querySelector('[name="' + CSS.escape(result.field) + '"]');
            if (field) { setError(field, result.message || "Please check this field."); field.focus(); }
          }
          throw new Error(result.message || "We could not submit your enquiry. Please try again.");
        }
        if (status) {
          status.className = "webform-status is-visible " + (result.emailSent ? "is-success" : "is-error");
          status.textContent = result.message || "Thank you. Your enquiry has been received.";
          status.focus?.();
        }
        form.reset();
        fields.forEach((field) => setError(field, ""));
      } catch (error) {
        if (status) {
          status.className = "webform-status is-visible is-error";
          status.textContent = error instanceof Error ? error.message : "Something went wrong. Please try again.";
        }
      } finally {
        form.dataset.submitting = "false";
        if (submit) {
          submit.disabled = false;
          submit.textContent = submit.dataset.originalText || "Submit Enquiry";
        }
      }
    });
  });
})();