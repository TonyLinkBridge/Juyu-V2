export type ReaderAnnouncement = {id: string; revision: string; message: string};
// Trusted general policy only. Role-scoped/admin-authored notices belong to T054.
export const readerAnnouncement: ReaderAnnouncement = {
  id: 'internal-materials', revision: '1', message: '内部资料仅供团队使用，请以已发布内容为准。',
};
