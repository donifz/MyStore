module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/*.e2e-spec.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  testTimeout: 30000,
};
