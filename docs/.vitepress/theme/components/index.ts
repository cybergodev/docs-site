// Barrel export for every custom theme component.
//
// theme/index.ts imports from here for both global registration (enhanceApp)
// and Layout-slot injection. Adding a component = create the .vue + add one
// line below; no scattered imports across theme/index.ts.

export { default as GitHubIcon } from './GitHubIcon.vue'
export { default as NotFound } from './NotFound.vue'
export { default as LanguageMenu } from './LanguageMenu.vue'
export { default as LanguagePrompt } from './LanguagePrompt.vue'
export { default as SiteFooter } from './SiteFooter.vue'
export { default as DocFeedback } from './DocFeedback.vue'
export { default as ProjectNavBarTitle } from './ProjectNavBarTitle.vue'
export { default as ProjectGitHubLink } from './ProjectGitHubLink.vue'
export { default as ProjectGrid } from './ProjectGrid.vue'
export { default as CliCommand } from './CliCommand.vue'
export { default as GoPlaygroundButton } from './GoPlaygroundButton.vue'
