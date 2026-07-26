export interface PostMediaInput {
  type: "image" | "video" | "tiktok";
  url: string;
  tiktokVideoId?: string;
  caption?: string;
}

export interface PostCreateRequest {
  title: string;
  content: string;
  city: string;
  poiIds: string[];
  tags: string[];
  media: PostMediaInput[];
}

export type PostUpdateRequest = Partial<PostCreateRequest>;
