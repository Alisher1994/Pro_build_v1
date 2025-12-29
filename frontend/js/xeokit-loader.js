import * as xeokit from "./xeokit-bundle.js";

// Expose xeokit SDK as a global for the legacy viewer modules.
window.xeokit = xeokit;

// Notify any listeners that the xeokit global is now available.
window.dispatchEvent(new Event("xeokit:ready"));
