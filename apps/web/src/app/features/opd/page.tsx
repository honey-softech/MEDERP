import { FeatureArticle, featureMetadata } from "@/components/feature-article";

export const metadata = featureMetadata("opd");

export default function OpdFeaturePage() {
  return <FeatureArticle slug="opd" />;
}
