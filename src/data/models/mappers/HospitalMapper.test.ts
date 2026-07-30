import { describe, it, expect } from 'vitest';
import { HospitalMapper } from './HospitalMapper';

describe('HospitalMapper', () => {
  describe('parseThreeState', () => {
    it('should return null for undefined, null, empty string, and whitespace', () => {
      expect(HospitalMapper.parseThreeState(undefined)).toBeNull();
      expect(HospitalMapper.parseThreeState(null)).toBeNull();
      expect(HospitalMapper.parseThreeState('')).toBeNull();
      expect(HospitalMapper.parseThreeState('   ')).toBeNull();
    });

    it('should return false for "0" and 0', () => {
      expect(HospitalMapper.parseThreeState('0')).toBe(false);
      expect(HospitalMapper.parseThreeState(0)).toBe(false);
    });

    it('should return true for "1" and 1', () => {
      expect(HospitalMapper.parseThreeState('1')).toBe(true);
      expect(HospitalMapper.parseThreeState(1)).toBe(true);
    });

    it('should return null for negative numbers and non-numeric strings', () => {
      expect(HospitalMapper.parseThreeState('-1')).toBeNull();
      expect(HospitalMapper.parseThreeState(-1)).toBeNull();
      expect(HospitalMapper.parseThreeState('abc')).toBeNull();
    });

    it('should return true for "Y" and false for "N"', () => {
      expect(HospitalMapper.parseThreeState('Y')).toBe(true);
      expect(HospitalMapper.parseThreeState('y')).toBe(true);
      expect(HospitalMapper.parseThreeState('N')).toBe(false);
      expect(HospitalMapper.parseThreeState('n')).toBe(false);
      expect(HospitalMapper.parseThreeState('other')).toBeNull();
    });
  });

  describe('combineIcuFields', () => {
    it('should return null if all fields are missing', () => {
      expect(HospitalMapper.combineIcuFields([undefined, null, ''])).toBeNull();
    });

    it('should return false if all fields are 0', () => {
      expect(HospitalMapper.combineIcuFields(['0', 0, '0'])).toBe(false);
    });

    it('should return true if at least one field is positive', () => {
      expect(HospitalMapper.combineIcuFields(['0', '1', null])).toBe(true);
      expect(HospitalMapper.combineIcuFields([null, null, 1])).toBe(true);
    });

    it('should return null if fields are a mix of 0 and missing', () => {
      expect(HospitalMapper.combineIcuFields(['0', undefined, null])).toBeNull();
      expect(HospitalMapper.combineIcuFields(['0', '', null])).toBeNull();
    });
  });

  describe('dutyEmcls should not affect ICU availability', () => {
    it('dutyEmcls is mapped to TraumaLevel but does not determine ICU', () => {
      const dto = {
        basicInfo: { hpid: 'A123', dutyName: 'Test Hosp', dutyEmcls: 'A11', wgs84Lat: 37, wgs84Lon: 127 },
        bedInfo: {}
      } as any;
      const domain = HospitalMapper.toDomain(dto);
      expect(domain?.traumaLevel).toBe(1); // 'A' prefix
      expect(domain?.hasNeuroIcu).toBeNull();
      expect(domain?.hasGeneralIcu).toBeNull();
    });
  });
});
