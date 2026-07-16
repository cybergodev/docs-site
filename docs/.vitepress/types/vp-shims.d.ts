// Minimal type shim for VitePress default-theme SFCs we import directly
// (VPFlyout, VPMenuLink in LanguageMenu.vue). VitePress ships these as plain
// `.vue` files whose own internal imports are untyped, which would otherwise
// make vue-tsc follow into node_modules and fail. tsconfig `paths` redirects
// both specifiers here so type-checking stays focused on our own code.
import type { DefineComponent } from 'vue'

declare const component: DefineComponent<Record<string, any>, Record<string, any>, any>

export default component
