import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';

type Props = {
  html: string;
  color: string;
};

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
    />
  );
}
