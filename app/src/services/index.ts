// Single import surface for domain services.
// Usage: import { DescribeService, AskService } from '@/services';

export * as DescribeService from './DescribeService';
export * as AskService from './AskService';
export * as MemoryService from './MemoryService';
export * as OnboardingService from './OnboardingService';
export * as HeartbeatService from './HeartbeatService';
// CopyModule lands in E1.2 and re-exports here:
//   export { COPY, type Copy } from './CopyModule';
