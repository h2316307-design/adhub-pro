import { describe, it, expect } from 'vitest';
import { resolveContractAvailableToggleState } from '../services/billboardAvailabilityService';

const info = (totalCount: number, forceHideCount: number, effectiveForceShowCount: number) => ({
  totalCount,
  forceHideCount,
  effectiveForceShowCount,
});

describe('resolveContractAvailableToggleState — علم العقد هو مصدر الحقيقة', () => {
  it('عقد مفعل ولوحاته null (حالة عقد 1287) يظهر مفعلاً وليس «غير مفعل»', () => {
    expect(resolveContractAvailableToggleState(true, info(17, 0, 0))).toBe('ALL_ON');
  });

  it('عقد مفعل وكل لوحاته مفعلة', () => {
    expect(resolveContractAvailableToggleState(true, info(5, 0, 5))).toBe('ALL_ON');
  });

  it('عقد مفعل مع لوحات مخفية إدارياً أو محجوبة = جزئي', () => {
    expect(resolveContractAvailableToggleState(true, info(5, 2, 3))).toBe('MIXED');
  });

  it('عقد غير مفعل وبلا أعلام = غير مفعل', () => {
    expect(resolveContractAvailableToggleState(false, info(5, 0, 0))).toBe('ALL_OFF');
  });

  it('عقد غير مفعل مع أعلام إظهار عالقة على لوحاته = جزئي (الضغط ينظفها)', () => {
    expect(resolveContractAvailableToggleState(false, info(5, 0, 2))).toBe('MIXED');
  });

  it('بدون معلومات اللوحات يعتمد على علم العقد فقط', () => {
    expect(resolveContractAvailableToggleState(true, null)).toBe('ALL_ON');
    expect(resolveContractAvailableToggleState(false, null)).toBe('ALL_OFF');
  });
});
