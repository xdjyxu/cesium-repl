// Simple re-export of the globally-set Sandcastle API object.
// window.Sandcastle is set in onMounted (useCesiumSandbox) before any user code runs.
export default globalThis.Sandcastle
