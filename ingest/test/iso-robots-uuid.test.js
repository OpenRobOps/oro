import assert from 'assert';
import { deriveEntityUuid } from '../src/server/iso21423/entityUuid';

const DNS_NS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('iso21423 deriveEntityUuid', () => {
  it('matches the RFC 4122 v5 test vector', () => {
    assert.strictEqual(
      deriveEntityUuid('www.example.com', DNS_NS),
      '2ed6657d-e927-568b-95e1-2665a8aea6a2');
  });

  it('is deterministic, lowercase, and correctly versioned', () => {
    const a = deriveEntityUuid('flatland-ros2', DNS_NS);
    assert.strictEqual(a, deriveEntityUuid('flatland-ros2', DNS_NS));
    assert.strictEqual(a, a.toLowerCase());
    assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('separates namespaces', () => {
    assert.notStrictEqual(
      deriveEntityUuid('r1', DNS_NS),
      deriveEntityUuid('r1', '11111111-1111-4111-8111-111111111111'));
  });

  it('throws on a malformed namespace', () => {
    assert.throws(() => deriveEntityUuid('r1', 'nope'), /namespace/);
  });
});
