// What the patient can look up about the hospital that discharged them. Every
// entry is synthetic, like the patients: addresses, numbers and hours are
// invented for the demo and are not those of any real hospital.
const DIRECTORY = {
  "Bayfront Health": {
    address: "701 Harbor View Drive, St. Petersburg, FL 33701",
    phone: "(727) 555-0140",
    switchboard: "Open 24 hours",
  },
  "Lakeside Regional": {
    address: "4200 Lakeshore Boulevard, Lakeland, FL 33803",
    phone: "(863) 555-0122",
    switchboard: "Open 24 hours",
  },
  "Mercy Medical": {
    address: "1850 Mercy Way, Clearwater, FL 33756",
    phone: "(727) 555-0187",
    switchboard: "Open 24 hours",
  },
  Moffitt: {
    address: "12902 Magnolia Drive, Tampa, FL 33612",
    phone: "(813) 555-0160",
    switchboard: "Open 24 hours",
  },
  "St. Vincent's": {
    address: "2 Shircliff Way, Jacksonville, FL 32204",
    phone: "(904) 555-0133",
    switchboard: "Open 24 hours",
  },
  "Tampa General": {
    address: "1 Tampa General Circle, Tampa, FL 33606",
    phone: "(813) 555-0100",
    switchboard: "Open 24 hours",
  },
};

const UNITS = {
  "Respiratory Unit": {
    floor: "Level 2, East wing",
    hours: "Nurses' line 8 am to 6 pm, Monday to Friday",
    about:
      "Cares for people recovering from pneumonia, COPD flare-ups and other lung infections after they leave hospital.",
  },
  Pulmonary: {
    floor: "Level 3, North wing",
    hours: "Nurses' line 8 am to 6 pm, Monday to Friday",
    about:
      "Follows lung conditions after discharge, including COPD, asthma and blood clots in the lung.",
  },
  "Sleep Medicine": {
    floor: "Outpatients, Level 1",
    hours: "Clinic 9 am to 5 pm, Monday to Friday",
    about: "Sets up and adjusts CPAP and follows sleep apnea after discharge.",
  },
  "General Medicine": {
    floor: "Level 4, South wing",
    hours: "Nurses' line 8 am to 8 pm, every day",
    about:
      "The acute medicine team that treated your infection and follows your recovery at home.",
  },
  "General Surgery": {
    floor: "Level 5, Surgical wing",
    hours: "Surgical nurses' line 8 am to 6 pm, Monday to Friday",
    about:
      "The team that performed your operation and reviews wound healing and recovery.",
  },
  "Malignant Hematology": {
    floor: "Oncology Day Unit, Level 2",
    hours: "Oncology hotline open 24 hours",
    about:
      "Manages chemotherapy cycles and watches for infection while your blood counts are low.",
  },
  Cardiology: {
    floor: "Level 3, Heart Centre",
    hours: "Heart nurses' line 8 am to 6 pm, Monday to Friday",
    about:
      "Follows heart failure, rhythm problems and recovery after cardiac admissions.",
  },
  "Colorectal Surgery": {
    floor: "Level 5, Surgical wing",
    hours: "Surgical nurses' line 8 am to 6 pm, Monday to Friday",
    about:
      "The team that performed your bowel operation and follows your recovery.",
  },
  Maternity: {
    floor: "Level 2, Women's wing",
    hours: "Maternity triage open 24 hours",
    about:
      "Postnatal care and recovery after delivery, including caesarean section.",
  },
  Neurology: {
    floor: "Level 4, North wing",
    hours: "Stroke nurses' line 8 am to 6 pm, Monday to Friday",
    about: "Follows recovery after stroke and other neurological admissions.",
  },
  Orthopaedics: {
    floor: "Level 6, Orthopaedic wing",
    hours: "Physiotherapy line 8 am to 5 pm, Monday to Friday",
    about:
      "The team that replaced your joint and guides walking and exercises afterwards.",
  },
};

// "Bayfront Health, Respiratory Unit" -> details for both parts.
export function hospitalInfo(full) {
  const [name, unit] = String(full || "").split(", ");
  return {
    name,
    unit: unit || null,
    ...(DIRECTORY[name] || {
      address: "Address on your discharge letter",
      phone: "Number on your discharge letter",
      switchboard: "",
    }),
    ...(UNITS[unit] || { floor: "", hours: "", about: "" }),
  };
}
