import DocumentReferenceView from '@/components/DocumentReferenceView';

export default function DocumentReferencePage({
  params,
}: {
  params: { id: string; chunkId: string };
}) {
  return <DocumentReferenceView documentId={params.id} chunkId={params.chunkId} />;
}
