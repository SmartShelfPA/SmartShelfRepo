import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import RenderHtml, { HTMLContentModel, HTMLElementModel } from 'react-native-render-html';

type Props = {
  html: string;
  color: string;
};

const customHTMLElementModels = {
  img: HTMLElementModel.fromCustomModel({
    tagName: 'img',
    contentModel: HTMLContentModel.block,
  }),
};

function DiagramImage({
  tnode,
}: {
  tnode: { attributes: { src?: string; alt?: string } };
}) {
  const src = tnode.attributes?.src?.trim();
  if (!src) return null;
  return (
    <Image
      source={{ uri: src }}
      style={{ width: '100%', height: 200, marginVertical: 8, borderRadius: 10, backgroundColor: '#ffffff' }}
      contentFit="contain"
      accessibilityLabel={tnode.attributes.alt || 'Diagram'}
    />
  );
}

export function HtmlContent({ html, color }: Props) {
  const { width } = useWindowDimensions();
  const tagsStyles = useMemo(
    () => ({
      body: { color },
      p: { color },
      span: { color },
      strong: { color },
      em: { color },
      li: { color },
    }),
    [color]
  );

  return (
    <RenderHtml
      contentWidth={Math.max(280, width - 32)}
      source={{ html }}
      tagsStyles={tagsStyles}
      customHTMLElementModels={customHTMLElementModels}
      renderers={{ img: DiagramImage }}
    />
  );
}
