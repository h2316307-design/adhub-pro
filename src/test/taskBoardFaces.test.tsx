import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/components/installation/BoardMediaEditor', () => ({ BoardMediaEditor: () => null }));
vi.mock('@/services/installationFaceSelection', () => ({ saveInstallationFaceSelection: vi.fn() }));
import { TaskBoardCard } from '@/components/installation/TaskBoardCard';

function render(faces: number, selection?: number[]) {
  return renderToStaticMarkup(<TaskBoardCard item={{ id: 'item', task_id: 'task', billboard_id: 1, status: 'pending', selected_faces: selection, design_face_a: '/front.png', design_face_b: '/back.png' }} billboard={{ Faces_Count: faces, Billboard_Name: 'Test' }} selected={false} printActive={false} onSelect={() => {}} onPhoto={() => {}} onManage={() => {}} onPreview={() => {}} onRefresh={() => {}} />);
}
describe('installation card design previews', () => {
  it('does not show a stale back design for a single-face billboard', () => {
    const html = render(1);
    expect(html).toContain('/front.png');
    expect(html).not.toContain('/back.png');
    expect(html).toContain('الأوجه المطلوب تركيبها');
  });
  it('shows both designs when both faces are requested', () => {
    const html = render(2);
    expect(html).toContain('/front.png');
    expect(html).toContain('/back.png');
  });
  it('shows the back design for a back-only installation', () => {
    const html = render(2, [2]);
    expect(html).not.toContain('/front.png');
    expect(html).toContain('/back.png');
  });
});
