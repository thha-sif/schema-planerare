document.addEventListener("DOMContentLoaded", () => {
  const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
  const MAX_LOGO_SIZE_LABEL = "2 MB";

  const form = document.getElementById("bannerSettingsForm");
  const clubNameInput = document.getElementById("clubNameInput");
  const primaryColorInput = document.getElementById("primaryColorInput");
  const logoInput = document.getElementById("logoInput");
  const removeLogoInput = document.getElementById("removeLogoInput");
  const logoPreview = document.getElementById("logoPreview");
  const hint = document.getElementById("settingsHint");
  const resetDefaultsBtn = document.getElementById("resetDefaultsBtn");
  const settingsBackLink = document.getElementById("settingsBackLink");

  const bannerSettings = window.scheduleBannerSettings;
  if (!bannerSettings || typeof bannerSettings.get !== "function") {
    if (hint) hint.textContent = "Kunde inte ladda bannerinställningar.";
    return;
  }

  function setHint(text) {
    if (hint) hint.textContent = text;
  }

  function syncPreview(dataUrl) {
    if (!logoPreview) return;
    if (dataUrl) {
      logoPreview.src = dataUrl;
      logoPreview.hidden = false;
    } else {
      logoPreview.removeAttribute("src");
      logoPreview.hidden = true;
    }
  }

  function fillForm() {
    const current = bannerSettings.get();
    if (clubNameInput) clubNameInput.value = current.clubName || "";
    if (primaryColorInput) primaryColorInput.value = current.primaryColor || bannerSettings.defaults.primaryColor;
    if (logoInput) logoInput.value = "";
    if (removeLogoInput) removeLogoInput.checked = false;
    syncPreview(current.clubLogoDataUrl || "");
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Kunde inte läsa filen."));
      reader.readAsDataURL(file);
    });
  }

  function validateLogoFile(file) {
    if (!file) return "";
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      return `Filen är för stor. Max storlek är ${MAX_LOGO_SIZE_LABEL}.`;
    }
    return "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const current = bannerSettings.get();

    let nextLogo = current.clubLogoDataUrl || "";

    try {
      if (removeLogoInput && removeLogoInput.checked) {
        nextLogo = "";
      } else if (logoInput && logoInput.files && logoInput.files[0]) {
        const file = logoInput.files[0];
        const validationError = validateLogoFile(file);
        if (validationError) {
          setHint(validationError);
          return;
        }
        nextLogo = await fileToDataUrl(file);
      }

      bannerSettings.set({
        clubName: clubNameInput ? clubNameInput.value : current.clubName,
        primaryColor: primaryColorInput ? primaryColorInput.value : current.primaryColor,
        clubLogoDataUrl: nextLogo
      });

      fillForm();
      setHint("Inställningar sparade.");
    } catch {
      setHint("Något gick fel när inställningarna skulle sparas.");
    }
  });

  if (resetDefaultsBtn) {
    resetDefaultsBtn.addEventListener("click", () => {
      bannerSettings.clear();
      fillForm();
      setHint("Återställd till standardvärden.");
    });
  }

  if (logoInput) {
    logoInput.addEventListener("change", () => {
      if (!logoInput.files || !logoInput.files[0]) {
        if (!removeLogoInput || !removeLogoInput.checked) {
          syncPreview(bannerSettings.get().clubLogoDataUrl || "");
        }
        return;
      }

      const file = logoInput.files[0];
      const validationError = validateLogoFile(file);
      if (validationError) {
        logoInput.value = "";
        syncPreview(bannerSettings.get().clubLogoDataUrl || "");
        setHint(validationError);
        return;
      }

      fileToDataUrl(file)
        .then((dataUrl) => {
          syncPreview(dataUrl);
          setHint("Ny logga vald. Klicka Spara för att bekräfta.");
        })
        .catch(() => {
          setHint("Kunde inte läsa loggfilen.");
        });
    });
  }

  if (removeLogoInput) {
    removeLogoInput.addEventListener("change", () => {
      if (removeLogoInput.checked) {
        syncPreview("");
        setHint("Loggan tas bort när du sparar.");
      } else {
        const current = bannerSettings.get();
        syncPreview(current.clubLogoDataUrl || "");
      }
    });
  }

  if (settingsBackLink) {
    settingsBackLink.addEventListener("click", (event) => {
      event.preventDefault();

      if (window.history.length > 1) {
        window.history.back();
        return;
      }

      window.location.href = "../index.html";
    });
  }

  fillForm();
});
