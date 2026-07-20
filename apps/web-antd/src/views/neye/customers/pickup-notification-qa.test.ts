import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const viewsRoot = join(process.cwd(), 'apps/web-antd/src/views/neye');

describe('pickup notification customer workspace integration', () => {
  it('keeps the empty state paired with the optometry selection branch', () => {
    const source = readFileSync(
      join(viewsRoot, 'customers/detail.vue'),
      'utf8',
    );
    expect(source).toContain('<template v-if="selectedOptometryId">');
    expect(source).toMatch(
      /<template v-if="selectedOptometryId">[\s\S]*<PickupNotificationPanel[\s\S]*<\/template>\s*<section v-else/,
    );
  });

  it('explains the post-ready subscription behavior before confirmation', () => {
    const source = readFileSync(
      join(viewsRoot, 'components/PickupNotificationPanel.vue'),
      'utf8',
    );
    expect(source).toContain('未订阅也可标记，顾客后续订阅将立即发送');
  });
});
