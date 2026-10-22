export type FieldSemanticType =
  | 'text'
  | 'price'
  | 'mrp'
  | 'currency'
  | 'url'
  | 'image'
  | 'rating'
  | 'rating_count'
  | 'review_count'
  | 'date'
  | 'custom';

export interface FieldDefinition {
  name: string;
  type: FieldSemanticType;
  required: boolean;
  description?: string;
  customRegex?: string;
}

export type RecordPresetType =
  | 'ecommerce'
  | 'b2b_listing'
  | 'social_post'
  | 'social_profile'
  | 'custom';

export interface RecordPresetConfig {
  id: RecordPresetType;
  label: string;
  description: string;
  fields: FieldDefinition[];
}

export const PRESET_SCHEMAS: Record<RecordPresetType, RecordPresetConfig> = {
  ecommerce: {
    id: 'ecommerce',
    label: 'E-Commerce Product',
    description: 'Product listings with selling price, list MRP, rating, and media',
    fields: [
      { name: 'title', type: 'text', required: true, description: 'Product title or headline' },
      { name: 'selling_price', type: 'price', required: true, description: 'Current active purchase price' },
      { name: 'mrp', type: 'mrp', required: false, description: 'Original or strikethrough list price' },
      { name: 'currency', type: 'currency', required: false, description: 'Currency symbol or ISO code' },
      { name: 'rating', type: 'rating', required: false, description: 'Product star rating (0-5 or 0-10)' },
      { name: 'image_url', type: 'image', required: false, description: 'Product primary thumbnail image' },
      { name: 'product_url', type: 'url', required: false, description: 'Link to full product details' }
    ]
  },
  b2b_listing: {
    id: 'b2b_listing',
    label: 'B2B Marketplace Listing',
    description: 'B2B products/services, supplier company, location, and quotation',
    fields: [
      { name: 'product_or_service', type: 'text', required: true, description: 'Service or product name' },
      { name: 'company_name', type: 'text', required: true, description: 'Supplier or company name' },
      { name: 'price_or_status', type: 'price', required: false, description: 'Unit price or quotation status' },
      { name: 'location', type: 'text', required: false, description: 'Supplier city, state, or country' },
      { name: 'contact_url', type: 'url', required: false, description: 'Contact or inquiry link' },
      { name: 'image_url', type: 'image', required: false, description: 'Listing photo or catalogue image' }
    ]
  },
  social_post: {
    id: 'social_post',
    label: 'Social Media Post',
    description: 'Feed posts with author, text content, timestamp, and post link',
    fields: [
      { name: 'author_name', type: 'text', required: true, description: 'Author or account display name' },
      { name: 'author_handle', type: 'text', required: false, description: 'Handle or username (@user)' },
      { name: 'content_text', type: 'text', required: true, description: 'Main text body of the post' },
      { name: 'timestamp', type: 'date', required: false, description: 'Posted date or relative time' },
      { name: 'post_url', type: 'url', required: false, description: 'Direct link to post' },
      { name: 'media_url', type: 'image', required: false, description: 'Attached media or preview image' }
    ]
  },
  social_profile: {
    id: 'social_profile',
    label: 'Social Profile / Directory',
    description: 'User or member directory profiles with headline and link',
    fields: [
      { name: 'display_name', type: 'text', required: true, description: 'Full name or organization' },
      { name: 'handle', type: 'text', required: true, description: 'Username, handle or profile id' },
      { name: 'bio', type: 'text', required: false, description: 'Headline, role, or biography text' },
      { name: 'avatar_url', type: 'image', required: false, description: 'Profile picture avatar' },
      { name: 'profile_url', type: 'url', required: false, description: 'Link to user profile' }
    ]
  },
  custom: {
    id: 'custom',
    label: 'Custom Schema',
    description: 'User-specified target fields and data types',
    fields: [
      { name: 'title', type: 'text', required: true, description: 'Item title or identifier' }
    ]
  }
};
