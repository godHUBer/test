import {intakeConfig} from '@/lib/business/config';
import {PublicIntake} from '@/components/business/public-intake';
import type { Brand,Vehicle } from '@/lib/inventory/model';
import { formatPrice,vehicleName } from '@/lib/inventory/model';
export function VehicleEnquiry({car,brand}:{car:Vehicle;brand:Brand}){
  if(intakeConfig())return <section className="band band--surface" id="enquire"><div className="wrap"><h2>Enquire about this car</h2><PublicIntake source="vehicle" kind="car" vehicleId={car.id}/><p>Need help? Call {brand.phoneDisplay}. A request is not a booking confirmation.</p></div></section>;
  return <section className="band band--surface" id="enquire"><div className="wrap grid g-7-5"><div><p className="kicker">Ask the showroom</p><h2>Enquire about this car</h2><p>This form opens your email app. Nothing is submitted to or stored by the website; only sending the composed email contacts the showroom. Viewing requests are not confirmed bookings.</p>
    <form className="form form--2" action={`mailto:${brand.email}`} method="post" encType="text/plain" data-mailto={brand.email} data-subject={`Enquiry: ${vehicleName(car)}`} data-context={`Listing ${car.id}: ${vehicleName(car)} ${car.variant}, asking ${formatPrice(car.priceRupees)}`} noValidate>
      <div className="field"><label htmlFor="e-name">Your name *</label><input id="e-name" name="Name" type="text" autoComplete="name" required maxLength={120}/><span className="error-msg">Please add your name.</span></div>
      <div className="field"><label htmlFor="e-phone">Phone number *</label><input id="e-phone" name="Phone" type="tel" autoComplete="tel" required maxLength={30}/><span className="error-msg">Add a contact number.</span></div>
      <div className="field"><label htmlFor="e-email">Email</label><input id="e-email" name="Email" type="email" autoComplete="email" maxLength={254}/></div>
      <div className="field"><label htmlFor="e-when">Preferred viewing</label><select id="e-when" name="Preferred viewing"><option value="">No preference</option><option>This week</option><option>Next week</option><option>Weekend</option></select></div>
      <div className="field form__full"><label htmlFor="e-msg">Your question *</label><textarea id="e-msg" name="Question" required maxLength={3000}/><span className="error-msg">Add a question.</span></div>
      <div className="form__full"><button className="btn btn--solid" type="submit">Compose enquiry email</button><div className="form__status" role="status" tabIndex={-1}/></div>
    </form></div><aside className="notes"><h3>Before travelling</h3><p>Confirm current availability, documents, condition and the asking price.</p><p><a href={`tel:${brand.phoneHref}`}>Call {brand.phoneDisplay}</a></p><p>{brand.hours||'Opening hours are not confirmed.'}</p></aside></div></section>;
}
