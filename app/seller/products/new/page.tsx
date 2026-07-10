import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getMyBusiness } from "@/lib/seller";
import { ProductForm } from "@/components/seller/ProductForm";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const user = await getSessionUser();
  const biz = user ? await getMyBusiness(user.id) : null;
  if (!biz) redirect("/onboard/start");

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-semibold">Add a product</h1>
      <ProductForm />
    </div>
  );
}
