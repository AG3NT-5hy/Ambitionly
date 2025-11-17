// CommonJS helper to load Hono constructor
// This file uses pure CommonJS to avoid tsx module resolution issues

const honoModule = require("hono");

// Try multiple ways to get the Hono constructor
let Hono = null;

// Access default via bracket notation in case it's a getter
const defaultExport = honoModule["default"] || honoModule.default;

// 1. Try named export
if (honoModule.Hono && typeof honoModule.Hono === "function") {
  Hono = honoModule.Hono;
}
// 2. Try default.Hono (nested)
else if (defaultExport?.Hono && typeof defaultExport.Hono === "function") {
  Hono = defaultExport.Hono;
}
// 3. Try default as constructor
else if (defaultExport && typeof defaultExport === "function") {
  Hono = defaultExport;
}
// 4. Try module itself as constructor
else if (typeof honoModule === "function") {
  Hono = honoModule;
}
// 5. Try accessing via property descriptor (for getters)
else {
  try {
    const desc = Object.getOwnPropertyDescriptor(honoModule, "default");
    if (desc?.value && typeof desc.value === "function") {
      Hono = desc.value;
    } else if (desc?.get) {
      try {
        const getterValue = desc.get();
        if (getterValue && typeof getterValue === "function") {
          Hono = getterValue;
        } else if (getterValue?.Hono && typeof getterValue.Hono === "function") {
          Hono = getterValue.Hono;
        }
      } catch (getterError) {
        // Getter might throw, ignore
      }
    }
  } catch (e) {
    // Ignore errors from property descriptor access
  }
}

if (!Hono || typeof Hono !== "function") {
  const moduleKeys = Object.keys(honoModule);
  const defaultKeys = defaultExport ? Object.keys(defaultExport) : [];
  const desc = Object.getOwnPropertyDescriptor(honoModule, "default");
  const errorInfo = {
    moduleKeys,
    defaultKeys,
    defaultType: typeof defaultExport,
    defaultViaBracket: typeof honoModule["default"],
    propertyDescriptor: desc ? {
      hasValue: !!desc.value,
      valueType: typeof desc.value,
      hasGet: !!desc.get,
      hasSet: !!desc.set
    } : null,
    moduleType: typeof honoModule
  };
  throw new Error(
    `[Hono] Failed to load Hono constructor.\n` +
    JSON.stringify(errorInfo, null, 2)
  );
}

module.exports = Hono;

