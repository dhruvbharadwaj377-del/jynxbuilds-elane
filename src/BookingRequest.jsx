import { useId, useState } from "react";

const SERVICES = ["Hair", "Skin", "Nails", "Bridal", "Not sure yet"];
const TIMES = ["Morning", "Afternoon", "Evening", "Any time"];

// Elane is a concept demo: the form shows how a request would be taken, but
// it sends nothing and contacts no one. Submitting only confirms that.
export default function BookingRequest() {
  const id = useId();
  const [sent, setSent] = useState(false);

  const onSubmit = (event) => {
    event.preventDefault();
    setSent(true);
  };

  return (
    <form className="booking-form" onSubmit={onSubmit}>
      <div className="booking-field">
        <label htmlFor={`${id}-name`}>Your name</label>
        <input id={`${id}-name`} name="name" type="text" autoComplete="name" required />
      </div>

      <div className="booking-row">
        <div className="booking-field">
          <label htmlFor={`${id}-service`}>Service</label>
          <select id={`${id}-service`} name="service" defaultValue="Hair">
            {SERVICES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="booking-field">
          <label htmlFor={`${id}-time`}>Time of day</label>
          <select id={`${id}-time`} name="time" defaultValue="Any time">
            {TIMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="booking-field">
        <label htmlFor={`${id}-date`}>
          Preferred date <small>(optional)</small>
        </label>
        <input id={`${id}-date`} name="date" type="date" />
      </div>

      <div className="booking-field">
        <label htmlFor={`${id}-note`}>
          Anything we should know <small>(optional)</small>
        </label>
        <textarea id={`${id}-note`} name="note" rows={3} />
      </div>

      <button type="submit" className="booking-button">
        Submit demo request
        <span aria-hidden="true">↗</span>
      </button>

      <p className="booking-note" role="status">
        {sent
          ? "Nothing has been sent and no appointment has been booked. Elane Beauty House is a concept demonstration, not a real salon."
          : "Concept demonstration only — this form does not book an appointment, contact a salon or send your details anywhere."}
      </p>
    </form>
  );
}
