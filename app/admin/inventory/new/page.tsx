'use client';
import { StaffGate } from '@/components/admin/staff-gate';
import { VehicleForm } from '@/components/admin/forms';

export default function NewVehicle() {
  return (
    <StaffGate title="Create inventory draft">
      {(session) => <VehicleForm canEdit manager={session.profile!.role !== 'staff'} />}
    </StaffGate>
  );
}
