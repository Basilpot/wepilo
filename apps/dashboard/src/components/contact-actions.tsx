import { Mail, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

// Opens the agency's own mail, phone or WhatsApp app with the customer's
// details filled in. Many travel leads are answered on WhatsApp first.

/** wa.me wants the number in international form, digits only. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

export function ContactActions({
  name,
  email,
  phone,
  subject,
  size = "sm",
}: {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string;
  size?: "sm" | "default";
}) {
  const first = name.trim().split(/\s+/)[0] || "there";
  const wa = whatsappNumber(phone);
  const greeting = `Hi ${first}, thanks for getting in touch${subject ? ` about ${subject}` : ""}.`;
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size={size}>
        <a href={`mailto:${email}?subject=${encodeURIComponent(subject ? `Re: ${subject}` : "Re: your inquiry")}`}>
          <Mail />
          Email
        </a>
      </Button>
      {wa && (
        <Button asChild size={size} variant="outline">
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(greeting)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle />
            WhatsApp
          </a>
        </Button>
      )}
      {phone?.trim() && (
        <Button asChild size={size} variant="outline">
          <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
            <Phone />
            Call
          </a>
        </Button>
      )}
    </div>
  );
}
