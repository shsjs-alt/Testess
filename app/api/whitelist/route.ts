// app/api/whitelist/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export async function GET() {
  try {
    const domainsCol = collection(firestore, 'whitelistedDomains');
    const domainSnapshot = await getDocs(domainsCol);
    const domains = domainSnapshot.docs.map(doc => doc.id);
    return NextResponse.json({ domains });
  } catch (error) {
    console.error("Error fetching whitelisted domains:", error);
    return NextResponse.json({ error: "Failed to fetch whitelisted domains." }, { status: 500 });
  }
}