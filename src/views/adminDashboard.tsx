import React from "react";
import View from "./view";
import { useNavigate } from "react-router-dom";
import NotFound from "./notFound";
import Button from "../components/button";
import { pizzaService } from "../service/service";
import {
  Franchise,
  FranchiseList,
  Role,
  Store,
  User,
} from "../service/pizzaService";
import { TrashIcon } from "../icons";

interface Props {
  user: User | null;
}

export default function AdminDashboard(props: Props) {
  const navigate = useNavigate();

  // ─── Users state ──────────────────────────────────────────────────────────────
  const [userList, setUserList] = React.useState<{ users: User[]; more: boolean }>({
    users: [],
    more: false,
  });
  const [userPage, setUserPage] = React.useState(0); // 0‑based page index
  const [userFilter, setUserFilter] = React.useState("*");
  const filterUserRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    (async () => {
      if (Role.isRole(props.user, Role.Admin)) {
        const result = await pizzaService.getUsers(userPage, 10, userFilter);
        setUserList(result);
      }
    })();
  }, [props.user, userPage, userFilter]);

  async function deleteUser(userId: string) {
    if (window.confirm("Are you sure you want to delete this user?")) {
      await pizzaService.deleteUser(userId);
      const result = await pizzaService.getUsers(userPage, 10, userFilter);
      setUserList(result);
    }
  }

  function applyUserFilter() {
    const value = filterUserRef.current?.value?.trim();
    const filter = value ? `*${value}*` : "*";
    // reset to first page whenever filter changes
    setUserPage(0);
    setUserFilter(filter);
  }

  // ─── Franchise state ─────────────────────────────────────────────────────────
  const [franchiseList, setFranchiseList] = React.useState<FranchiseList>({
    franchises: [],
    more: false,
  });
  const [franchisePage, setFranchisePage] = React.useState(0);
  const [franchiseFilter, setFranchiseFilter] = React.useState("*");
  const filterFranchiseRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    (async () => {
      if (Role.isRole(props.user, Role.Admin)) {
        const result = await pizzaService.getFranchises(
          franchisePage,
          10,
          franchiseFilter
        );
        setFranchiseList(result);
      }
    })();
  }, [props.user, franchisePage, franchiseFilter]);

  function applyFranchiseFilter() {
    const value = filterFranchiseRef.current?.value?.trim();
    const filter = value ? `*${value}*` : "*";
    setFranchisePage(0);
    setFranchiseFilter(filter);
  }

  // ─── Navigation actions ──────────────────────────────────────────────────────
  function createFranchise() {
    navigate("/admin-dashboard/create-franchise");
  }

  function closeFranchise(franchise: Franchise) {
    navigate("/admin-dashboard/close-franchise", {
      state: { franchise },
    });
  }

  function closeStore(franchise: Franchise, store: Store) {
    navigate("/admin-dashboard/close-store", {
      state: { franchise, store },
    });
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (!Role.isRole(props.user, Role.Admin)) {
    return <NotFound />;
  }

  return (
    <View title="Mama Ricci's kitchen">
      {/* Users */}
      <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
        <h3 className="text-neutral-100 text-xl">Users</h3>
        <div className="bg-neutral-100 overflow-clip my-4">
          <div className="flex flex-col">
            <div className="-m-1.5 overflow-x-auto">
              <div className="p-1.5 min-w-full inline-block align-middle">
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="uppercase text-neutral-100 bg-slate-400 border-b-2 border-gray-500">
                      <tr>
                        {["Name", "Email", "Roles", "Action"].map((header) => (
                          <th
                            key={header}
                            scope="col"
                            className="px-6 py-3 text-center text-xs font-medium"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {userList.users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-100">
                          <td className="px-6 py-4 whitespace-nowrap text-start text-xs sm:text-sm text-gray-800">
                            {user.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-start text-xs sm:text-sm text-gray-800">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-start text-xs sm:text-sm text-gray-800">
                            {user.roles?.map((r) => r.role).join(", ")}
                          </td>
                          <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                            <button
                              type="button"
                              className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-red-400 text-red-400 hover:border-red-800 hover:text-red-800 disabled:border-neutral-300 disabled:text-neutral-300"
                              onClick={() => deleteUser(user.id ?? "")}
                              disabled={user.id === props.user?.id}
                            >
                              <TrashIcon />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="px-1 py-1">
                          <input
                            type="text"
                            ref={filterUserRef}
                            name="filterUser"
                            placeholder="Filter users"
                            className="px-2 py-1 text-sm border border-gray-300 rounded-lg"
                          />
                          <button
                            type="button"
                            className="ml-2 px-2 py-1 text-sm font-semibold rounded-lg border border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                            onClick={applyUserFilter}
                          >
                            Search
                          </button>
                        </td>
                        <td colSpan={3} className="text-end text-sm font-medium">
                          <button
                            className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
                            onClick={() => setUserPage((p) => p - 1)}
                            disabled={userPage <= 0}
                          >
                            «
                          </button>
                          <button
                            className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
                            onClick={() => setUserPage((p) => p + 1)}
                            disabled={!userList.more}
                          >
                            »
                          </button>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Franchises */}
      <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
        <h3 className="text-neutral-100 text-xl">Franchises</h3>
        <div className="bg-neutral-100 overflow-clip my-4">
          <div className="flex flex-col">
            <div className="-m-1.5 overflow-x-auto">
              <div className="p-1.5 min-w-full inline-block align-middle">
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="uppercase text-neutral-100 bg-slate-400 border-b-2 border-gray-500">
                      <tr>
                        {[
                          "Franchise",
                          "Franchisee",
                          "Store",
                          "Revenue",
                          "Action",
                        ].map((header) => (
                          <th
                            key={header}
                            scope="col"
                            className="px-6 py-3 text-center text-xs font-medium"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    {franchiseList.franchises.map((franchise, findex) => (
                      <tbody
                        key={findex}
                        className="divide-y divide-gray-200"
                      >
                        <tr className="border-neutral-500 border-t-2">
                          <td className="text-start px-2 whitespace-nowrap text-l font-mono text-orange-600">
                            {franchise.name}
                          </td>
                          <td
                            className="text-start px-2 whitespace-nowrap text-sm font-normal text-gray-800"
                            colSpan={3}
                          >
                            {franchise.admins
                              ?.map((o) => o.name)
                              .join(", ")}
                          </td>
                          <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                            <button
                              type="button"
                              className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                              onClick={() => closeFranchise(franchise)}
                            >
                              <TrashIcon />
                              Close
                            </button>
                          </td>
                        </tr>

                        {franchise.stores.map((store, sindex) => (
                          <tr key={sindex} className="bg-neutral-100">
                            <td
                              className="text-end px-2 whitespace-nowrap text-sm text-gray-800"
                              colSpan={3}
                            >
                              {store.name}
                            </td>
                            <td className="text-end px-2 whitespace-nowrap text-sm text-gray-800">
                              {store.totalRevenue?.toLocaleString()} ₿
                            </td>
                            <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                              <button
                                type="button"
                                className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                                onClick={() => closeStore(franchise, store)}
                              >
                                <TrashIcon />
                                Close
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                    <tfoot>
                      <tr>
                        <td className="px-1 py-1">
                          <input
                            type="text"
                            ref={filterFranchiseRef}
                            name="filterFranchise"
                            placeholder="Filter franchises"
                            className="px-2 py-1 text-sm border border-gray-300 rounded-lg"
                          />
                          <button
                            type="button"
                            className="ml-2 px-2 py-1 text-sm font-semibold rounded-lg border border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                            onClick={applyFranchiseFilter}
                          >
                            Search
                          </button>
                        </td>
                        <td
                          colSpan={4}
                          className="text-end text-sm font-medium"
                        >
                          <button
                            className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300 "
                            onClick={() =>
                              setFranchisePage((p) => p - 1)
                            }
                            disabled={franchisePage <= 0}
                          >
                            «
                          </button>
                          <button
                            className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
                            onClick={() =>
                              setFranchisePage((p) => p + 1)
                            }
                            disabled={!franchiseList.more}
                          >
                            »
                          </button>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <Button
          className="w-36 text-xs sm:text-sm sm:w-64"
          title="Add Franchise"
          onPress={createFranchise}
        />
      </div>
    </View>
  );
}
