import type {StockStatus,VehicleFields} from './validation';
export interface StaffVehicle extends Omit<VehicleFields,'price_lakh'> {id:string;status:StockStatus;version:number;price_lakh:string|number;photo_stock:string|null;photos_gallery:string[];media_order:string[];created_at:string;updated_at:string}
export interface MediaAsset {id:string;vehicle_id:string;uploaded_by:string;object_path:string;public_path:string|null;state:'pending'|'ready'|'publishing'|'published'|'removed';bytes:number|null;width:number|null;height:number|null;created_at:string}
export interface StockEvent {id:number;vehicle_id:string;actor_id:string|null;event_type:string;from_status:string|null;to_status:string;reason:string|null;at:string}
