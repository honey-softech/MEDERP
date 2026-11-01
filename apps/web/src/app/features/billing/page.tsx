import { FeatureArticle, featureMetadata } from "@/components/feature-article";

export const metadata = featureMetadata("billing");

export default function BillingFeaturePage() {
  return <FeatureArticle slug="billing" />;
}
