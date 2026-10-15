import React from 'react';
import { CompositeOperationsView } from '@/pages/CompositeOperations';

interface CompositeTasksListProps {
  customerId?: string;
}

/** كل استخدامات قائمة أوامر العمل تعرض النظام الموحد الجديد */
export const CompositeTasksList: React.FC<CompositeTasksListProps> = ({ customerId }) => {
  return <CompositeOperationsView customerId={customerId} embedded={!!customerId} />;
};
