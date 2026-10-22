import { describe, it, expect } from 'vitest';
import { PRESET_SCHEMAS, RecordPresetType } from '../../src/modules/types/schema';

describe('Schema Contracts', () => {
  it('defines all required preset schemas', () => {
    const expectedPresets: RecordPresetType[] = [
      'ecommerce',
      'b2b_listing',
      'social_post',
      'social_profile',
      'custom'
    ];

    expectedPresets.forEach((preset) => {
      expect(PRESET_SCHEMAS[preset]).toBeDefined();
      expect(PRESET_SCHEMAS[preset].id).toBe(preset);
      expect(PRESET_SCHEMAS[preset].fields.length).toBeGreaterThan(0);
    });
  });

  it('contains valid required fields for ecommerce', () => {
    const ecommerce = PRESET_SCHEMAS.ecommerce;
    const titleField = ecommerce.fields.find((f) => f.name === 'title');
    const priceField = ecommerce.fields.find((f) => f.name === 'selling_price');
    const mrpField = ecommerce.fields.find((f) => f.name === 'mrp');

    expect(titleField).toBeDefined();
    expect(titleField?.required).toBe(true);
    expect(titleField?.type).toBe('text');

    expect(priceField).toBeDefined();
    expect(priceField?.required).toBe(true);
    expect(priceField?.type).toBe('price');

    expect(mrpField).toBeDefined();
    expect(mrpField?.required).toBe(false);
    expect(mrpField?.type).toBe('mrp');
  });

  it('contains valid required fields for b2b listing', () => {
    const b2b = PRESET_SCHEMAS.b2b_listing;
    const productField = b2b.fields.find((f) => f.name === 'product_or_service');
    const companyField = b2b.fields.find((f) => f.name === 'company_name');

    expect(productField?.required).toBe(true);
    expect(companyField?.required).toBe(true);
  });

  it('contains valid required fields for social post', () => {
    const post = PRESET_SCHEMAS.social_post;
    const authorField = post.fields.find((f) => f.name === 'author_name');
    const contentField = post.fields.find((f) => f.name === 'content_text');

    expect(authorField?.required).toBe(true);
    expect(contentField?.required).toBe(true);
  });
});
