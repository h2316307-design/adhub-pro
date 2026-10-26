import { computeOperation, type CostLine } from '@/lib/compositeCosts';
import { describe, it, expect } from 'vitest';
import { splitCampaignFaces, executedInstallationFaces, hasAmbiguousInstalledFace } from '@/lib/campaignInstallationFaces';
const board = { Faces_Count: 2 };
describe('campaign face history', () => {
  it('splits the same board between first installation and repeat work', () => {
    expect(splitCampaignFaces(board, [{ status: 'completed', selected_faces: [1] }])).toEqual({ first: [2], repeat: [1], done: [1] });
  });
  it('preserves the identity of a completed back face', () => {
    expect(splitCampaignFaces(board, [{ status: 'completed', faces_to_install: 1, reinstalled_faces: 'face_b' }])).toEqual({ first: [1], repeat: [2], done: [2] });
  });
  it('combines separate executions, and never treats pending requested faces as installed', () => {
    expect(splitCampaignFaces(board, [{ status: 'completed', selected_faces: [1] }, { status: 'completed', selected_faces: [2] }]).repeat).toEqual([1,2]);
    expect(splitCampaignFaces(board, [{ status: 'pending', selected_faces: [1,2] }]).first).toEqual([1,2]);
  });
  it('keeps partial photo evidence separate and ignores cancelled work', () => {
    expect(executedInstallationFaces({ status: 'pending', selected_faces: [1,2], installed_image_face_a_url: 'photo' },board)).toEqual([1]);
    expect(executedInstallationFaces({ status: 'cancelled', selected_faces: [1,2], completed_at: '2026-10-26' },board)).toEqual([]);
  });
  it('respects one-face boards and explicit campaign selection', () => {
    expect(splitCampaignFaces({ Faces_Count: 1 }, []).first).toEqual([1]);
    expect(splitCampaignFaces(board, [], [2]).first).toEqual([2]);
  });
});

it('flags historical single-face completion with no face identity for review', () => {
  expect(hasAmbiguousInstalledFace({status:'completed',faces_to_install:1},board)).toBe(true);
  expect(hasAmbiguousInstalledFace({status:'completed',faces_to_install:1,selected_faces:[2]},board)).toBe(false);
});

it('uses uniquely identified photo evidence for legacy single-face work', () => {
  expect(executedInstallationFaces({status:'completed',faces_to_install:1,installed_image_face_b_url:'back'},board)).toEqual([2]);
});

it('keeps company expense while charging only the repeat section to the customer', () => {
  const line: CostLine = { id:'1',taskId:'t',billboardId:1,faceArea:12,faces:1,selectedFaces:[2],customer:100,company:60,customerExtra:0,companyExtra:0,inPrint:true,hasCutout:false,cutoutCount:0,cutoutCustomerUnit:0,cutoutCompanyUnit:0 };
  const draft = { type:'new_installation' as const,contractIncludesInstallation:true,contractIncludesPrint:true,lines:[line],printEnabled:true,printCustomerPerMeter:10,printCompanyPerMeter:5,discount:0 };
  const first=computeOperation(draft);
  const repeat=computeOperation({...draft,type:'reinstallation',lines:[{...line,selectedFaces:[1]}]});
  expect(first.customerTotal).toBe(0);
  expect(first.companyTotal).toBe(120);
  expect(first.contractExpense).toBe(120);
  expect(repeat.customerTotal).toBe(220);
  expect(repeat.companyTotal).toBe(120);
});
