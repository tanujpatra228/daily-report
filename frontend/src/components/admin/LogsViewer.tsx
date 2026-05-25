import { useState } from 'react';
import { useTeamLogs } from '@/lib/query/hooks/useLogs';
import { useUsersByTeam } from '@/lib/query/hooks/useUsers';
import { useProjects } from '@/lib/query/hooks/useProjects';
import { useTeams } from '@/lib/query/hooks/useTeams';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store/store';
import { setSelectedTeam } from '@/store/slices/teamsSlice';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogsDataTable } from '@/components/logs/LogsDataTable';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate } from '@/utils/formatting';
import { istToIso } from '@/utils/date';
import { useAuth } from '@/hooks/useAuth';

export function LogsViewer() {
  const { isAdmin } = useAuth();
  const dispatch = useDispatch();
  const selectedTeamId = useSelector((state: RootState) => state.teams.selectedTeamId);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [userId, setUserId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [teamId, setTeamId] = useState<number | null>(selectedTeamId);

  // Convert date range to IST strings, then to ISO for API
  const startDate = dateRange?.from ? formatDate(dateRange.from) : undefined;
  const endDate = dateRange?.to ? formatDate(dateRange.to) : undefined;

  const { data: teams = [] } = useTeams({ isAdmin });
  const { data: logs = [], isLoading: logsLoading } = useTeamLogs(teamId, {
    startDate: startDate ? istToIso(startDate) : undefined,
    endDate: endDate ? istToIso(endDate) : undefined,
    userId: userId || undefined,
    projectId: projectId || undefined,
  });

  const { data: users = [] } = useUsersByTeam(teamId, isAdmin, { includeInactive: true });
  const { data: projects = [] } = useProjects(teamId, isAdmin);

  const handleTeamChange = (newTeamId: number | null) => {
    setTeamId(newTeamId);
    dispatch(setSelectedTeam(newTeamId));
    setUserId(null);
    setProjectId(null);
  };

  const handleEdit = () => {
    // Edit is handled by LogsDataTable
  };

  if (logsLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <DateRangePicker
              label="Date Range"
              value={dateRange}
              onChange={setDateRange}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Team</label>
              <Select
                value={teamId?.toString() || 'all'}
                onValueChange={(val) =>
                  handleTeamChange(val === 'all' ? null : parseInt(val, 10))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id.toString()}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Member</label>
              <Select
                value={userId?.toString() || 'all'}
                onValueChange={(val) => setUserId(val === 'all' ? null : parseInt(val, 10))}
                disabled={!teamId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Project</label>
              <Select
                value={projectId?.toString() || 'all'}
                onValueChange={(val) => setProjectId(val === 'all' ? null : parseInt(val, 10))}
                disabled={!teamId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <LogsDataTable
        logs={logs}
        projects={projects}
        users={users}
        isAdmin={true}
        isLoading={logsLoading}
        onEdit={handleEdit}
      />
    </div>
  );
}
