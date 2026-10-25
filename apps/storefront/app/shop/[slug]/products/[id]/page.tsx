// The product implementation remains shared with the legacy route while the
// canonical store route is introduced. Links are migrated separately so old
// bookmarks keep rendering the same product component.
export {
  default,
  generateMetadata,
} from '../../../../shops/[slug]/products/[id]/page';
