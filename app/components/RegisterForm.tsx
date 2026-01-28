"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userSchema } from "@/lib/zod";
import axios, { isAxiosError } from "axios";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { UploadButton } from "@/utils/uploadthing";
import { z } from "zod";

// FIX: Use z.infer to automatically match the schema (mobile is string)
type FormData = z.infer<typeof userSchema>;

// Props used by the ProofUpload component
type ProofUploadProps = {
  onUploaded: (url: string | null) => void;
  loadingUpload: boolean;
  setLoadingUpload: (loading: boolean) => void;
};

// ------------------- FILE UPLOAD COMPONENT -------------------
const ProofUpload = ({ onUploaded, loadingUpload, setLoadingUpload }: ProofUploadProps) => {
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [type, setType] = useState<string | undefined>(undefined);

  const handleClientComplete = (res: unknown) => {
    setLoadingUpload(false);

    if (!res || !Array.isArray(res) || res.length === 0) {
      toast.error("Upload failed: no response.");
      onUploaded(null);
      return;
    }

    const first = res[0] as Record<string, unknown> | undefined;
    if (!first) {
      toast.error("Upload failed: invalid response shape.");
      onUploaded(null);
      return;
    }

    let url: string | undefined;
    try {
      const maybeUrl = first.url;
      if (typeof maybeUrl === "function") {
        url = String((maybeUrl as (() => unknown))());
      } else if (typeof first.ufsUrl === "string") {
        url = first.ufsUrl as string;
      } else if (typeof maybeUrl === "string") {
        url = maybeUrl as string;
      }
    } catch (err) {
      if (typeof first.ufsUrl === "string") url = first.ufsUrl as string;
      if (!url && typeof first.url === "string") url = first.url as string;
      console.log(err);
    }

    const mime = typeof first.type === "string" ? (first.type as string) : undefined;
    const name = typeof first.name === "string" ? (first.name as string) : undefined;

    setType(mime);

    if (url) {
      setFilePreviewUrl(url);
      onUploaded(url);
      toast.success("File uploaded successfully!");
      return;
    }

    toast.error("Upload failed: no file URL returned.");
    onUploaded(null);
  };

  const handleError = (err: Error) => {
    setLoadingUpload(false);
    console.error("Upload error:", err);
    toast.error("Upload failed. Please try again.");
    onUploaded(null);
  };

  const removeFile = () => {
    setFilePreviewUrl(null);
    setType(undefined);
    onUploaded(null);
    toast("File removed", { icon: "🗑️" });
  };

  const isImage = (mime?: string) => mime?.startsWith("image/");
  const isPdf = (mime?: string) => mime === "application/pdf";

  return (
    <div className="mt-4">
      <p className="text-sm text-gray-700 mb-2">Upload Marksheet / TC / Degree (max 2MB)</p>

      {!filePreviewUrl ? (
        <UploadButton
          endpoint="documentUploader"
          appearance={{
            button: "bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700",
            container: "flex flex-col items-center gap-2",
            allowedContent: "text-sm text-gray-600",
          }}
          onUploadBegin={() => setLoadingUpload(true)}
          onClientUploadComplete={handleClientComplete}
          onUploadError={handleError}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 mt-3 w-full">
          {/* IMAGE PREVIEW */}
          {isImage(type) && (
            <Image
              height={100}
              width={100}
              src={filePreviewUrl}
              alt="Uploaded proof"
              className="rounded-lg border shadow-sm max-w-full object-contain max-h-80"
            />
          )}

          {/* PDF PREVIEW */}
          {isPdf(type) && (
            <div className="w-full">
              <div className="mb-2 text-sm text-gray-600">PDF Preview:</div>
              <div className="w-full h-80 border rounded overflow-hidden">
                <iframe
                  src={filePreviewUrl}
                  title="PDF preview"
                  className="w-full h-full"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
              </div>
              <div className="mt-2">
                <a href={filePreviewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
                  Open full document
                </a>
              </div>
            </div>
          )}

          {!isImage(type) && !isPdf(type) && (
            <a href={filePreviewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              View uploaded file
            </a>
          )}

          <div className="flex gap-4 mt-3">
            <button type="button" onClick={removeFile} className="text-red-600 hover:text-red-800 text-sm">
              Remove File
            </button>
          </div>
        </div>
      )}

      {loadingUpload && <div className="mt-2 text-sm text-gray-500">Uploading…</div>}
    </div>
  );
};

export default function RegisterForm() {
  const [submitted, setSubmitted] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(userSchema),
    mode: "onChange",
    defaultValues: {
      fullName: "",
      gradYear: 1968,
      branch: "",
      email: "",
      mobile: "", // FIX: Default to empty string
      organisation: "",
      designation: "",
      password: "",
      role: "alumni",
      proofPicture: "",
      location: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!proofUrl) {
      toast.error("Please upload your marksheet/TC/Degree before submitting.");
      return;
    }

    const loading = toast.loading("Registering...");
    try {
      setSubmitted(true);
      const res = await axios.post("/api/auth", {
        ...data,
        proofPicture: proofUrl,
        location: data.location,
      });

      if (res.status === 200) {
        toast.dismiss(loading);
        toast.success("Registration completed!");
        router.push("/login");
      }
      form.reset();
      setProofUrl(null);
    } catch (error) {
      toast.dismiss(loading);
      if (isAxiosError(error)) {
        toast.error(error.response?.data.message || "Registration failed");
      } else {
        toast.error("Something went wrong!");
      }
    } finally {
      setSubmitted(false);
    }
  };

  const years = Array.from({ length: 2030 - 1964 + 1 }, (_, i) => 1964 + i);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href={"/"} className="cursor-pointer">
                <Image src="/CollegeLogo.png" alt="Logo" width={48} height={48} className="rounded-md" />
              </Link>
              <div>
                <h1 className="text-[0px] md:text-lg font-semibold text-gray-900">Alumni</h1>
                <p className="text-sm text-gray-600">Government Engineering College Bilaspur</p>
              </div>
            </div>

            <Link href="/login" className="hidden md:block">
              <Button className="bg-blue-600 hover:bg-blue-700">Login</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="py-12 bg-gray-50 text-black">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">Complete Your Registration</h2>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* Full Name */}
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Grad Year + Branch */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="gradYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Graduation Year *</FormLabel>
                        <FormControl>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={String(field.value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Year" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                              {years.map((year) => (
                                <SelectItem key={year} value={String(year)}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="branch"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Branch / Department *</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Department" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Cse">Computer Science</SelectItem>
                              <SelectItem value="Et&t">Electronics & Telecomm</SelectItem>
                              <SelectItem value="Mech">Mechanical</SelectItem>
                              <SelectItem value="Civil">Civil</SelectItem>
                              <SelectItem value="Elec">Electrical</SelectItem>
                              <SelectItem value="Mining">Mining</SelectItem>
                              <SelectItem value="It">Information Tech</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Email + Mobile */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your.email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number *</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="9876543210"
                            maxLength={10}
                            {...field}
                            // FIX: Removed Number() casting to support Zod string schema
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Organisation + Designation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="organisation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Organisation *</FormLabel>
                        <FormControl>
                          <Input placeholder="Company/Organization" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="designation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Designation *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your position" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Location - REQUIRED */}
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (City / State) *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Bilaspur, Chhattisgarh" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Password */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Min 8 characters" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* File Upload */}
                <ProofUpload onUploaded={(url) => setProofUrl(url)} loadingUpload={loadingUpload} setLoadingUpload={setLoadingUpload} />

                {/* Submit */}
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={submitted || !proofUrl || loadingUpload}>
                  {submitted ? "Submitting..." : "Verify your mail and Join Alumni Network"}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </section>
    </div>
  );
}
