import { bookableServices } from "@/data/services-data";

/** The services an audience can be narrowed to: one list for every step that offers them. */
export const SERVICE_OPTIONS = bookableServices.map((service) => ({
  value: service.id,
  label: service.title,
}));
