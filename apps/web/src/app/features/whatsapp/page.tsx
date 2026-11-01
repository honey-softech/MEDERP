import { FeatureArticle, featureMetadata } from "@/components/feature-article";

export const metadata = featureMetadata("whatsapp");

export default function WhatsappFeaturePage() {
  return <FeatureArticle slug="whatsapp" />;
}
