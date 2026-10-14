import { describe, expect, it } from 'vitest';
import { findOptimalTeamForInstallation, sortTeamsByPriority } from '../utils/teamAssignment';
const teams = [
  { id: 'company', team_name: 'المركز العربي للدعاية', priority: 1, sizes: [], cities: [], friend_company_ids: ['company'] },
  { id: 'issa', team_name: 'فرقة عيسى', priority: 2, sizes: ['4x3'], cities: ['طرابلس'] },
  { id: 'abdel', team_name: 'فرقة عبد الرزاق العاتي', priority: 3, sizes: ['4x3'], cities: ['طرابلس'] },
];
describe('installation team precedence', () => {
  it('lists Abdulrazzaq then Issa according to saved priority', () => {
    expect(sortTeamsByPriority(teams).map(t => t.id)).toEqual(['abdel', 'issa', 'company']);
  });
  it('prefers the actual owner even when its saved rank is lower', () => {
    expect(findOptimalTeamForInstallation(teams, '4x3', 'طرابلس', 'company')?.id).toBe('company');
  });
  it('follows changed saved priority rather than team names', () => {
    expect(findOptimalTeamForInstallation(teams.map(t => t.id === 'issa' ? { ...t, priority: 10 } : t), '4x3', 'طرابلس', null)?.id).toBe('issa');
  });
  it('excludes a high-priority company that does not own the board', () => {
    const foreign = { ...teams[0], id: 'dana', team_name: 'دانة مصراتة', priority: 100, friend_company_ids: ['dana'] };
    expect(findOptimalTeamForInstallation([foreign, ...teams], '4x3', 'طرابلس', 'company')?.id).toBe('company');
    expect(findOptimalTeamForInstallation([foreign, ...teams], '4x3', 'طرابلس', null)?.id).toBe('abdel');
    expect(findOptimalTeamForInstallation([foreign], '4x3', 'طرابلس', null)).toBeNull();
  });
  it('uses Issa when Abdulrazzaq does not cover the city', () => {
    expect(findOptimalTeamForInstallation(teams.map(t => t.id === 'abdel' ? { ...t, cities: ['مصراتة'] } : t), '4x3', 'طرابلس', null)?.id).toBe('issa');
  });
  it('falls back to other eligible teams for unsupported sizes', () => {
    expect(findOptimalTeamForInstallation(teams, '8x3', 'طرابلس', 'company')?.id).toBe('company');
  });
  it('does not assign boards when no team covers size and city', () => {
    expect(findOptimalTeamForInstallation(teams.slice(1), '8x3', 'طرابلس', null)).toBeNull();
  });
});

it('routes western cities to Hisham instead of higher-ranked Tripoli crews', () => {
  const localTeams = [
    { id: 'abdel', priority: 100, sizes: ['4x3'], cities: ['طرابلس'] },
    { id: 'hisham', priority: 1, sizes: ['4x3'], cities: ['صبراتة', 'صرمان', 'زوارة'] },
  ];
  for (const city of ['صبراته', 'صرمان', 'زوارة']) {
    expect(findOptimalTeamForInstallation(localTeams, '4x3', city, null)?.id).toBe('hisham');
  }
  expect(findOptimalTeamForInstallation(localTeams, '4x3', 'مدينة أخرى', null)).toBeNull();
});

it('lets a company-linked Hisham serve other owners within his explicit cities', () => {
  const hisham = { id: 'hisham', priority: 1, sizes: ['4x3'], cities: ['صبراته', 'صرمان'], friend_company_ids: ['friends'] };
  const abdel = { id: 'abdel', priority: 100, sizes: ['4x3'], cities: ['طرابلس'] };
  for (const owner of [null, 'friends', 'other']) {
    for (const city of ['صبراتة', 'صرمان']) {
      expect(findOptimalTeamForInstallation([abdel, hisham], '4x3', city, owner)?.id).toBe('hisham');
    }
  }
  expect(findOptimalTeamForInstallation([hisham], '4x3', 'طرابلس', null)).toBeNull();
});
