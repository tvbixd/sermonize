/**
 * Tests that security-sensitive code is gated behind __DEV__.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

describe('Security gates', () => {
  it('dummy OTP bypass is gated behind __DEV__', () => {
    const signIn = fs.readFileSync(path.join(ROOT, 'app/sign-in.tsx'), 'utf-8');
    const match = signIn.match(/if\s*\(.*'000000'.*\)/);
    expect(match).toBeTruthy();
    expect(match![0]).toContain('__DEV__');
  });

  it('setTestUser is gated behind __DEV__', () => {
    const auth = fs.readFileSync(path.join(ROOT, 'src/context/auth.tsx'), 'utf-8');
    const fnBody = auth.slice(auth.indexOf('const setTestUser'));
    const firstLines = fnBody.slice(0, 200);
    expect(firstLines).toContain('__DEV__');
  });

  it('test user session is gated behind __DEV__', () => {
    const auth = fs.readFileSync(path.join(ROOT, 'src/context/auth.tsx'), 'utf-8');
    const sessionLine = auth.split('\n').find(l => l.includes('session:') && l.includes('testUser'));
    expect(sessionLine).toBeDefined();
    expect(sessionLine).toContain('__DEV__');
  });

  it('no hardcoded API key fallback in bible.ts', () => {
    const bible = fs.readFileSync(path.join(ROOT, 'src/services/bible.ts'), 'utf-8');
    expect(bible).not.toContain("'G3soqKoVXwubGLo0odCn1'");
  });

  it('ErrorBoundary is defined in root layout', () => {
    const layout = fs.readFileSync(path.join(ROOT, 'app/_layout.tsx'), 'utf-8');
    expect(layout).toContain('export function ErrorBoundary');
  });
});
