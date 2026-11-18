export interface CatalogItem {
  code: string;
  description: string;
}

export interface Catalog {
  id: string;
  name: string;
  items: CatalogItem[];
}

export interface TabScene {
  elements: any[];
  appState: any;
  files: any;
}

export interface TabData {
  id: string;
  name: string;
  scene: TabScene;
}

export interface Project {
  format: "elograph";
  version: "1.0";
  meta: {
    title: string;
    created: string;
    modified: string;
  };
  tabs: TabData[];
  activeTabId: string;
  catalogs: Catalog[];
}