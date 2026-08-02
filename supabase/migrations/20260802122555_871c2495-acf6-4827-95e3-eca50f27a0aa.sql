ALTER TYPE public.lf_status ADD VALUE IF NOT EXISTS 'Ready for Airport Pickup' AFTER 'Ready for Delivery';
ALTER TYPE public.lf_status ADD VALUE IF NOT EXISTS 'Passenger Picked Up' AFTER 'Delivered';
ALTER TYPE public.workflow_status ADD VALUE IF NOT EXISTS 'READY_FOR_AIRPORT_PICKUP' AFTER 'READY_FOR_COLLECTION';
ALTER TYPE public.workflow_status ADD VALUE IF NOT EXISTS 'PASSENGER_PICKED_UP' AFTER 'DELIVERED';