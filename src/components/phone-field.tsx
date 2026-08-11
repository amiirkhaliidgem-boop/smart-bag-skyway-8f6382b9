// International passenger phone input. Emits the canonical E.164 candidate
// (`+<calling code><national digits>`) so every consumer stores one format.
import { useEffect, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COUNTRY_OPTIONS,
  DEFAULT_COUNTRY,
  countryOf,
  nationalOf,
  phoneExample,
} from "@/lib/phone/intl";

export function PhoneField({
  value,
  onChange,
}: {
  value: string;
  onChange: (e164Candidate: string) => void;
}) {
  const [country, setCountry] = useState<CountryCode>(countryOf(value) ?? DEFAULT_COUNTRY);
  const [local, setLocal] = useState(() => nationalOf(value));

  // Re-sync when the dialog is reopened with a different record.
  useEffect(() => {
    setCountry(countryOf(value) ?? DEFAULT_COUNTRY);
    setLocal(nationalOf(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value === "" ? "" : countryOf(value), value === ""]);

  const calling =
    COUNTRY_OPTIONS.find((c) => c.code === country)?.callingCode ?? "+20";

  function emit(nextCountry: CountryCode, nextLocal: string) {
    const cc = COUNTRY_OPTIONS.find((c) => c.code === nextCountry)?.callingCode ?? "+20";
    const digits = nextLocal.replace(/\D/g, "").replace(/^0+/, "");
    onChange(digits ? `${cc}${digits}` : "");
  }

  return (
    <div className="flex gap-2">
      <Select
        value={country}
        onValueChange={(v) => {
          setCountry(v as CountryCode);
          emit(v as CountryCode, local);
        }}
      >
        <SelectTrigger className="w-[120px] shrink-0">
          <SelectValue>{`${country} ${calling}`}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {COUNTRY_OPTIONS.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.label} {c.callingCode}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={local}
        inputMode="tel"
        placeholder={phoneExample(country)}
        onChange={(e) => {
          setLocal(e.target.value);
          emit(country, e.target.value);
        }}
      />
    </div>
  );
}