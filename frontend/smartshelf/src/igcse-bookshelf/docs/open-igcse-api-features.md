# Open IGCSE API — features (upstream reference)

Pasted from the upstream project documentation. SmartShelf uses Django-normalized routes (`GET /api/igcse/…`) that proxy this shape; field names may differ slightly after normalization.

## Revision Notes

Revision notes are under construction!

## Questions

Selective questions and theory questions can be accessed through the `/api/questions` route.

- **subject:** the snake case subject name  
- **topic:** the snake case topic name  

The response is a JSON file with a `selective` and a `theory` field. An example with the expected data types is shown below. These fields may slightly change over time.

```ts
interface Response {
  selective: [
    {
      intro: string,
      statements: string[],
      image: string,
      question: string, // length > 0
      difficulty: number, // [0, 1, 2, 3]
      options: string[], // length = 4
      scheme: number, // [0, 1, 2, 3]
      explanation: string // length > 0
    }
  ],
  theory: [
    {
      intro: string,
      statements: string[],
      image: string,
      question: string, // length > 0
      difficulty: number, // [0, 1, 2, 3]
      scheme: string[], // length > 0
      explanation: string // length > 0
    }
  ]
}
```
