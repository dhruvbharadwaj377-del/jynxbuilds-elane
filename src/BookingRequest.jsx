import { useId, useState } from "react";

const EMAIL = "hello@elanebeautyhouse.com";
const SERVICES = ["Hair", "Skin", "Nails", "Bridal", "Not sure yet"];
const TIMES = ["Morning", "Afternoon", "Evening", "Any time"];

// An appointment *request*: it opens the visitor's email app with the details
// filled in. There is no booking system behind it, so nothing here ever
// claims an appointment is confirmed.
export default function BookingRequest() {
  const id = useId();
  const [sent, setSent] = useState(false);

  const onSubmit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const service = String(data.get("service") || "");
    const date = String(data.get("date") || "");
    const time = String(data.get("time") || "");
    const note = String(data.get("note") || "").trim();

    const subject = `Appointment request: ${service}${name ? ` (${name})` : ""}`;
    const body = [
      "Hello Elane,",
      "",
      "I would like to request an appointment.",
      "",
      `Name: ${name}`,
      `Service: ${service}`,
      `Preferred date: ${date || "Flexible"}`,
      `Preferred time: ${time}`,
      note ? `\n${note}` : "",
      "",
      "Thank you.",
    ].join("\n");

    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
        Email my request
        <span aria-hidden="true">↗</span>
      </button>

      <p className="booking-note" role="status">
        {sent
          ? "Your email app should now open with the request. Nothing is booked until Elane replies to confirm."
          : `This opens an email to ${EMAIL}. It is a request, not a confirmed booking: the team replies to confirm availability.`}
      </p>
    </form>
  );
}
