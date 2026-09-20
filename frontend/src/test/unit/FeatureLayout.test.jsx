import { render, screen } from "@testing-library/react";
import FeatureLayout from "../../components/FeatureLayout";

jest.mock("../../components/navbarNew", () => function NavbarMock() { return <div data-testid="navbar" />; });
jest.mock("../../components/footer", () => function FooterMock() { return <div data-testid="footer" />; });

describe("FeatureLayout workspace mode", () => {
  it("keeps the existing document layout as the default", () => {
    render(<FeatureLayout title="Trang thường"><div>Nội dung</div></FeatureLayout>);

    expect(screen.getByTestId("feature-layout")).toHaveAttribute("data-feature-workspace", "false");
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
    expect(screen.getByTestId("feature-main")).toHaveAttribute("data-feature-main", "true");
    expect(screen.getByTestId("feature-content")).toHaveAttribute("data-feature-content", "true");
  });

  it("removes the Footer only for an explicit workspace", () => {
    render(<FeatureLayout title="Workspace" workspaceMode><div>Nội dung</div></FeatureLayout>);

    expect(screen.getByTestId("feature-layout")).toHaveAttribute("data-feature-workspace", "true");
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
  });
});
