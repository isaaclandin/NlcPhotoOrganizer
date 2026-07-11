export interface FolderNode {
  id: string;
  name: string;
  children?: FolderNode[];
}

export const dropboxTree: FolderNode = {
  id: "dropbox",
  name: "Dropbox",
  children: [
    {
      id: "nlc",
      name: "NLC",
      children: [
        { id: "admin", name: "Admin" },
        { id: "brand-assets", name: "Brand Assets" },
        {
          id: "marketing",
          name: "Marketing",
          children: [
            {
              id: "photos",
              name: "Photos",
              children: [
                { id: "campaigns-2023", name: "2023 Campaigns" },
                {
                  id: "campaign-2024",
                  name: "2024 Campaign",
                  children: [
                    { id: "winter-shelter", name: "Winter Shelter" },
                    { id: "spring-drive", name: "Spring Drive" },
                    { id: "events", name: "Events" },
                    { id: "b-roll", name: "B-Roll" },
                  ],
                },
              ],
            },
          ],
        },
        { id: "designs", name: "Designs" },
        { id: "documents", name: "Documents" },
        { id: "community-programs", name: "Community Programs" },
        { id: "donor-relations", name: "Donor Relations" },
        { id: "finance", name: "Finance" },
        { id: "volunteer", name: "Volunteer" },
      ],
    },
  ],
};

export const defaultExpandedFolderIds = [
  "dropbox",
  "nlc",
  "marketing",
  "photos",
  "campaign-2024",
];

export const activeFolderId = "spring-drive";

export const breadcrumbPath = [
  "Dropbox",
  "NLC",
  "Marketing",
  "Photos",
  "2024 Campaign",
  "Spring Drive",
];
