import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiClientError, api, uploadFile } from "@/lib/api";
import { Check, ImagePlus, Loader2, Star, X } from "@/components/icons";
import { Field } from "@/components/form";
import { clearFieldError } from "@/lib/field-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Thumb } from "@/components/thumb";
import { cn } from "@/lib/utils";

type LinkInfo = {
  business: { name: string | null; logo: string | null };
  trip: { title: string | null; image: string | null };
  expiresAt: string;
};

const MAX_PHOTOS = 5;
const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** The page a traveller lands on from a review link or QR code. No sign-in: the link itself is the key. */
export function PublicReviewPage() {
  const { token = "" } = useParams();
  const info = useQuery({
    queryKey: ["review-link", token],
    queryFn: () => api<LinkInfo>(`/public/review/${token}`),
    retry: false,
  });

  const [form, setForm] = useState({ rating: 0, name: "", email: "", title: "", text: "" });
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = useMutation({
    mutationFn: () =>
      api(`/public/review/${token}/reviews`, {
        body: { name: form.name, email: form.email, rating: form.rating || undefined, title: form.title || undefined, text: form.text, images: photos },
      }),
    onSuccess: () => setDone(true),
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === "VALIDATION") setBanner("Please fix the highlighted fields and try again.");
      else setBanner(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    },
  });

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoError(null);
    const room = MAX_PHOTOS - photos.length;
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) setPhotoError(`You can add up to ${MAX_PHOTOS} photos.`);
    setUploading((n) => n + chosen.length);
    await Promise.all(
      chosen.map(async (file) => {
        try {
          const res = await uploadFile<{ url: string }>(`/public/review/${token}/photos`, file);
          setPhotos((p) => [...p, res.url]);
        } catch (err) {
          setPhotoError(err instanceof ApiClientError ? err.message : "That photo couldn't be uploaded. Please try another.");
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
    if (fileRef.current) fileRef.current.value = "";
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-svh bg-muted/30 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">{children}</div>
    </div>
  );

  if (info.isLoading) {
    return shell(
      <div className="space-y-4 rounded-2xl border bg-card p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>,
    );
  }

  if (info.isError || !info.data) {
    const err = info.error;
    return shell(
      <div className="rounded-2xl border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">This link can't be used</h1>
        <p className="mt-2 text-muted-foreground">
          {err instanceof ApiClientError ? err.message : "We couldn't open this review link. Please check your connection and try again."}
        </p>
      </div>,
    );
  }

  const { business, trip } = info.data;

  if (done) {
    return shell(
      <div className="rounded-2xl border bg-card p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Thank you for your review</h1>
        <p className="mt-2 text-muted-foreground">
          {business.name ?? "The team"} will read it, and it will appear on their website once they approve it.
        </p>
      </div>,
    );
  }

  return shell(
    <div className="overflow-hidden rounded-2xl border bg-card text-card-foreground">
      <div className="flex items-center gap-4 border-b p-6">
        <Thumb src={trip.image} name={trip.title ?? business.name ?? "Trip"} className="h-14 w-20" />
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{business.name}</p>
          <h1 className="text-xl leading-tight font-semibold tracking-tight">How was {trip.title ?? "your trip"}?</h1>
        </div>
      </div>

      <form
        className="space-y-6 p-6"
        // Once someone starts fixing things, the red banner has done its job.
        onInput={() => banner && setBanner(null)}
        onSubmit={(e) => {
          e.preventDefault();
          setBanner(null);
          submit.mutate();
        }}
      >
        {banner && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{banner}</p>}

        <Field label="Your rating" name="rating" required>
          <div className="flex items-center gap-3">
            <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={form.rating === n}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  onClick={() => {
                    setForm((f) => ({ ...f, rating: n }));
                    clearFieldError("rating");
                  }}
                  className="rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Star className={cn("size-8 transition-colors", n <= form.rating ? "fill-primary text-primary" : "text-muted-foreground/40")} />
                </button>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">{RATING_WORDS[form.rating]}</span>
          </div>
        </Field>

        <Field label="Your review" name="text" required hint="What did you enjoy? What would you tell someone thinking of booking?">
          <Textarea rows={5} value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} />
        </Field>

        <Field label="Headline" name="title" hint="Optional. A short summary, for example “Best trek of my life”.">
          <Input value={form.title} maxLength={120} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </Field>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Photos</p>
          <p className="text-[13px] text-muted-foreground">Optional. Add up to {MAX_PHOTOS} photos from your trip.</p>
          <div className="flex flex-wrap gap-3">
            {photos.map((url) => (
              <div key={url} className="relative">
                <img src={url} alt="" className="size-20 rounded-lg border object-cover" />
                <button
                  type="button"
                  aria-label="Remove this photo"
                  onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                  className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {Array.from({ length: uploading }).map((_, i) => (
              <div key={i} className="flex size-20 items-center justify-center rounded-lg border bg-muted">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ))}
            {photos.length + uploading < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted"
              >
                <ImagePlus className="size-5" />
                Add
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => void addPhotos(e.target.files)} />
          {photoError && <p role="alert" className="text-[13px] text-destructive">{photoError}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" name="name" required hint="Shown with your review.">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoComplete="name" />
          </Field>
          <Field label="Email" name="email" hint="Optional. Only the team sees it, never the public.">
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoComplete="email" />
          </Field>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submit.isPending || uploading > 0}>
          {submit.isPending && <Loader2 className="animate-spin" />}
          Send review
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By sending this you agree that {business.name ?? "the team"} may show your review and photos on their website.
        </p>
      </form>
    </div>,
  );
}
