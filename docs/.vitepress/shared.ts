export const PROJECTS = ['json', 'jwt', 'httpc', 'html', 'dd', 'env'] as const
export type ProjectName = (typeof PROJECTS)[number]
